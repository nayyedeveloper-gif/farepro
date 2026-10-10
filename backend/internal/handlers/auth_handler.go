package handlers

import (
	"net/http"
	"telegram-clone/internal/auth"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	userRepo   *repository.UserRepository
	orgRepo    *repository.OrganizationRepository
	jwtService *auth.JWTService
	qrStore    *auth.QRStore
}

func NewAuthHandler(
	userRepo *repository.UserRepository,
	orgRepo *repository.OrganizationRepository,
	jwtService *auth.JWTService,
	qrStore *auth.QRStore,
) *AuthHandler {
	return &AuthHandler{
		userRepo:   userRepo,
		orgRepo:    orgRepo,
		jwtService: jwtService,
		qrStore:    qrStore,
	}
}

func (h *AuthHandler) issueTokenForUser(user *models.User) (string, *models.Organization, string, error) {
	orgs, err := h.orgRepo.GetUserOrganizations(user.ID)
	if err == nil && len(orgs) > 0 {
		membership := orgs[0]
		org, err := h.orgRepo.GetByID(membership.OrganizationID)
		if err != nil {
			return "", nil, "", err
		}
		token, err := h.jwtService.GenerateOrgToken(user.ID, user.Username, membership.OrganizationID, membership.Role)
		if err != nil {
			return "", nil, "", err
		}
		return token, org, membership.Role, nil
	}

	token, err := h.jwtService.GenerateToken(user.ID, user.Username)
	if err != nil {
		return "", nil, "", err
	}
	return token, nil, "", nil
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user exists by phone
	existingUser, err := h.userRepo.GetByPhone(req.Phone)
	if err == nil && existingUser != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User already exists"})
		return
	}

	// Hash password
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := &models.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Username + "@placeholder.local",
		Phone:        req.Phone,
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
	}

	if err := h.userRepo.Create(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user", "details": err.Error()})
		return
	}

	// Generate token
	token, err := h.jwtService.GenerateToken(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set online status
	h.userRepo.SetOnlineStatus(user.ID, true)

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"avatarUrl": user.AvatarURL,
		},
		"token": token,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by phone
	user, err := h.userRepo.GetByPhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check password
	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if banned, _ := h.userRepo.IsBanned(user.ID); banned {
		c.JSON(http.StatusForbidden, gin.H{"error": "This account has been suspended. Contact FarePro support.", "code": "account_suspended"})
		return
	}

	// Set online status
	h.userRepo.SetOnlineStatus(user.ID, true)

	token, org, role, err := h.issueTokenForUser(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"avatarUrl": user.AvatarURL,
		},
		"token": token,
	}
	if org != nil {
		resp["organization"] = gin.H{
			"id":        org.ID,
			"name":      org.Name,
			"subdomain": org.Subdomain,
			"plan":      org.Plan,
		}
		resp["role"] = role
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	// Set offline status
	h.userRepo.SetOnlineStatus(userID, false)

	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

func (h *AuthHandler) CreateQRSession(c *gin.Context) {
	session, err := h.qrStore.Create()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create QR session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"sessionId": session.ID.String(),
		"token":     session.Token,
		"expiresAt": session.ExpiresAt,
	})
}

func (h *AuthHandler) GetQRSessionStatus(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}
	session, ok := h.qrStore.Get(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	resp := gin.H{"status": session.Status}
	if session.Status == auth.QRStatusApproved && session.UserID != nil {
		user, err := h.userRepo.GetByID(*session.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
			return
		}
		resp["token"] = session.JWT
		resp["user"] = gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"avatarUrl": user.AvatarURL,
		}
	}
	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) ApproveQRSession(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	var req struct {
		SessionID string `json:"sessionId" binding:"required"`
		Token     string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}
	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	token, err := h.jwtService.GenerateToken(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	if err := h.qrStore.Approve(sessionID, req.Token, userID, token); err != nil {
		switch err {
		case auth.ErrQRSessionNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case auth.ErrQRSessionExpired, auth.ErrQRInvalidToken, auth.ErrQRSessionUsed:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	h.userRepo.SetOnlineStatus(userID, true)
	c.JSON(http.StatusOK, gin.H{
		"message": "Login approved",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"avatarUrl": user.AvatarURL,
		},
	})
}

func (h *AuthHandler) GetDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	currentDeviceID := c.Query("deviceId")
	devices := socket.GetUserDevices(userID)
	if devices == nil {
		devices = []socket.DeviceInfo{}
	}
	c.JSON(http.StatusOK, gin.H{
		"devices":         devices,
		"currentDeviceId": currentDeviceID,
		"sessionCount":    socket.GetUserSessionCount(userID),
	})
}

func (h *AuthHandler) TerminateDevice(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	clientID, err := uuid.Parse(c.Param("clientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client ID"})
		return
	}
	if !socket.DisconnectClient(userID, clientID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Device not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Device terminated"})
}

func (h *AuthHandler) TerminateOtherDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	deviceID := c.Query("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId required"})
		return
	}
	count := socket.DisconnectOtherClients(userID, deviceID)
	c.JSON(http.StatusOK, gin.H{"message": "Other sessions terminated", "terminated": count})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
