package handlers

import (
	"net/http"
	"os"
	"telegram-clone/internal/auth"
	"telegram-clone/internal/industry"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrganizationHandler struct {
	orgRepo     *repository.OrganizationRepository
	userRepo    *repository.UserRepository
	locRepo     *repository.ChannelLocationRepository
	channelRepo *repository.ChannelRepository
	jwtSvc      *auth.JWTService
}

func NewOrganizationHandler(
	orgRepo *repository.OrganizationRepository,
	userRepo *repository.UserRepository,
	locRepo *repository.ChannelLocationRepository,
	channelRepo *repository.ChannelRepository,
	jwtSvc *auth.JWTService,
) *OrganizationHandler {
	return &OrganizationHandler{
		orgRepo:     orgRepo,
		userRepo:    userRepo,
		locRepo:     locRepo,
		channelRepo: channelRepo,
		jwtSvc:      jwtSvc,
	}
}

// StandError carries an HTTP status for stand creation failures.
type StandError struct {
	Status  int
	Message string
}

func (e *StandError) Error() string { return e.Message }

// CreateStand creates the owner account, organization, owner membership and
// industry template channels. Shared by public signup and platform admin.
func (h *OrganizationHandler) CreateStand(req models.CreateOrganizationRequest, plan string, maxDrivers int) (*models.Organization, *models.User, []gin.H, error) {
	existingOrg, _ := h.orgRepo.GetBySubdomain(req.Subdomain)
	if existingOrg != nil {
		return nil, nil, nil, &StandError{http.StatusConflict, "Subdomain already taken"}
	}

	existingUser, _ := h.userRepo.GetByPhone(req.OwnerPhone)
	if existingUser != nil {
		return nil, nil, nil, &StandError{http.StatusConflict, "Phone number already registered"}
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, nil, nil, &StandError{http.StatusInternalServerError, "Failed to hash password"}
	}

	ownerID := uuid.New()
	owner := &models.User{
		ID:           ownerID,
		Username:     req.OwnerName,
		Email:        "",
		Phone:        req.OwnerPhone,
		PasswordHash: passwordHash,
		FirstName:    req.OwnerName,
	}
	if err := h.userRepo.Create(owner); err != nil {
		return nil, nil, nil, &StandError{http.StatusInternalServerError, "Failed to create owner account: " + err.Error()}
	}

	if plan == "" {
		plan = "free"
	}
	if maxDrivers <= 0 {
		maxDrivers = 10
	}
	orgID := uuid.New()
	industryID := industry.NormalizeIndustry(req.Industry)
	org := &models.Organization{
		ID:          orgID,
		Name:        req.Name,
		Subdomain:   req.Subdomain,
		Plan:        plan,
		MaxDrivers:  maxDrivers,
		MaxChannels: 5,
		OwnerID:     ownerID,
		Industry:    industryID,
	}
	if err := h.orgRepo.Create(org); err != nil {
		return nil, nil, nil, &StandError{http.StatusInternalServerError, "Failed to create organization: " + err.Error()}
	}

	if err := h.orgRepo.AddUserToOrg(ownerID, orgID, "owner"); err != nil {
		return nil, nil, nil, &StandError{http.StatusInternalServerError, "Failed to link owner to organization"}
	}

	createdChannels := h.provisionIndustryChannels(industryID, ownerID, orgID)
	return org, owner, createdChannels, nil
}

func (h *OrganizationHandler) Signup(c *gin.Context) {
	var req models.CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	org, owner, createdChannels, err := h.CreateStand(req, "free", 10)
	if err != nil {
		status := http.StatusInternalServerError
		if se, ok := err.(*StandError); ok {
			status = se.Status
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	token, err := h.jwtSvc.GenerateOrgToken(owner.ID, owner.Username, org.ID, "owner")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	h.userRepo.SetOnlineStatus(owner.ID, true)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Organization created successfully",
		"organization": gin.H{
			"id":        org.ID,
			"name":      org.Name,
			"subdomain": org.Subdomain,
			"plan":      org.Plan,
			"industry":  org.Industry,
		},
		"channels": createdChannels,
		"user": gin.H{
			"id":        owner.ID,
			"username":  owner.Username,
			"phone":     owner.Phone,
			"firstName": owner.FirstName,
		},
		"token": token,
	})
}

func (h *OrganizationHandler) Login(c *gin.Context) {
	var req models.OrgLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	subdomain := c.Query("subdomain")
	if subdomain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subdomain required"})
		return
	}

	org, err := h.orgRepo.GetBySubdomain(subdomain)
	if err != nil || org == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	user, err := h.userRepo.GetByPhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if banned, _ := h.userRepo.IsBanned(user.ID); banned {
		c.JSON(http.StatusForbidden, gin.H{"error": "This account has been suspended. Contact FarePro support.", "code": "account_suspended"})
		return
	}

	role, err := h.orgRepo.GetUserOrgRole(user.ID, org.ID)
	if err != nil || role == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a member of this organization"})
		return
	}

	token, err := h.jwtSvc.GenerateOrgToken(user.ID, user.Username, org.ID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	h.userRepo.SetOnlineStatus(user.ID, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"organization": gin.H{
			"id":        org.ID,
			"name":      org.Name,
			"subdomain": org.Subdomain,
			"plan":      org.Plan,
		},
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"avatarUrl": user.AvatarURL,
		},
		"role":  role,
		"token": token,
	})
}

func (h *OrganizationHandler) resolveOrgContext(c *gin.Context) (uuid.UUID, string, bool) {
	userID := c.MustGet("userID").(uuid.UUID)

	if orgIDVal, exists := c.Get("orgID"); exists {
		role, _ := c.Get("orgRole")
		roleStr, _ := role.(string)
		return orgIDVal.(uuid.UUID), roleStr, true
	}

	orgs, err := h.orgRepo.GetUserOrganizations(userID)
	if err != nil || len(orgs) == 0 {
		return uuid.Nil, "", false
	}

	return orgs[0].OrganizationID, orgs[0].Role, true
}

func (h *OrganizationHandler) orgSummary(org *models.Organization) gin.H {
	driverCount, _ := h.orgRepo.CountDrivers(org.ID)
	channelCount, _ := h.orgRepo.CountChannels(org.ID)
	return gin.H{
		"id":           org.ID,
		"name":         org.Name,
		"subdomain":    org.Subdomain,
		"plan":         org.Plan,
		"industry":     org.Industry,
		"maxDrivers":   org.MaxDrivers,
		"maxChannels":  org.MaxChannels,
		"logoUrl":      org.LogoURL,
		"driverCount":  driverCount,
		"channelCount": channelCount,
		"isActive":     org.IsActive,
		"createdAt":    org.CreatedAt,
	}
}

func (h *OrganizationHandler) GetContext(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	username, _ := c.Get("username")
	usernameStr, _ := username.(string)

	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"hasOrg": false})
		return
	}

	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"hasOrg": false})
		return
	}

	token, err := h.jwtSvc.GenerateOrgToken(userID, usernameStr, orgID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hasOrg":       true,
		"role":         role,
		"token":        token,
		"organization": h.orgSummary(org),
	})
}

func (h *OrganizationHandler) GetOrg(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}
	_ = role

	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	driverCount, _ := h.orgRepo.CountDrivers(org.ID)
	channelCount, _ := h.orgRepo.CountChannels(org.ID)

	c.JSON(http.StatusOK, gin.H{
		"id":                   org.ID,
		"name":                 org.Name,
		"subdomain":            org.Subdomain,
		"plan":                 org.Plan,
		"maxDrivers":           org.MaxDrivers,
		"maxChannels":          org.MaxChannels,
		"logoUrl":              org.LogoURL,
		"driverCount":          driverCount,
		"channelCount":         channelCount,
		"isActive":             org.IsActive,
		"createdAt":            org.CreatedAt,
		"fareRatePerKm":        org.FareRatePerKm,
		"fareMinimum":          org.FareMinimum,
		"fareNightMultiplier":  org.FareNightMultiplier,
		"fareNightStart":       org.FareNightStart,
		"fareNightEnd":         org.FareNightEnd,
		"bookingEnabled":       org.BookingEnabled,
		"customerAppTitle":     org.CustomerAppTitle,
		"autoDispatch":         org.AutoDispatch,
		"driverCreditFloorMmk": org.DriverCreditFloorMMK,
		"walletPaymentInfo":    org.WalletPaymentInfo,
		"demandCatalog":        repository.ParseDemandCatalog(org.DemandCatalogJSON),
	})
}

func (h *OrganizationHandler) UpdateOrg(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	var req models.UpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	if req.Name != "" {
		org.Name = req.Name
	}
	if req.LogoURL != "" {
		org.LogoURL = req.LogoURL
	}
	if req.Plan != "" {
		org.Plan = req.Plan
		switch req.Plan {
		case "pro":
			org.MaxDrivers = 50
			org.MaxChannels = 20
		case "enterprise":
			org.MaxDrivers = 500
			org.MaxChannels = 100
		default:
			org.MaxDrivers = 10
			org.MaxChannels = 5
		}
	}

	if err := h.orgRepo.Update(org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, org)
}

func (h *OrganizationHandler) GetMembers(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h *OrganizationHandler) InviteDriver(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	var req models.InviteDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := req.Role
	if role == "" {
		role = "driver"
	}
	if role != "driver" && role != "dispatcher" && role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	if role == "driver" {
		count, _ := h.orgRepo.CountDrivers(org.ID)
		if count >= org.MaxDrivers {
			c.JSON(http.StatusForbidden, gin.H{"error": "Driver limit reached for your plan"})
			return
		}
	}

	user, err := h.userRepo.GetByPhone(req.Phone)
	if err != nil {
		passwordHash, _ := auth.HashPassword("changeme123")
		user = &models.User{
			ID:           uuid.New(),
			Username:     req.FirstName + req.LastName,
			Phone:        req.Phone,
			PasswordHash: passwordHash,
			FirstName:    req.FirstName,
			LastName:     req.LastName,
		}
		if err := h.userRepo.Create(user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user", "details": err.Error()})
			return
		}
	}

	existingRole, _ := h.orgRepo.GetUserOrgRole(user.ID, org.ID)
	if existingRole != "" {
		c.JSON(http.StatusConflict, gin.H{"error": "User already in this organization"})
		return
	}

	if err := h.orgRepo.AddUserToOrg(user.ID, org.ID, role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add user to organization"})
		return
	}

	// Auto-join community channels so new drivers can PTT/chat immediately.
	if ch := h.ensureCommunityChannel(org.ID, org.OwnerID, user.ID, "Drivers Community", "org-community:drivers"); ch != nil {
		_ = h.channelRepo.JoinChannel(ch.ID, user.ID)
	}
	if ch := h.ensureCommunityChannel(org.ID, org.OwnerID, user.ID, "Admin Support", "org-community:support"); ch != nil {
		_ = h.channelRepo.JoinChannel(ch.ID, user.ID)
	}
	for _, name := range []string{"Drivers On Duty", "Dispatch"} {
		if ch, err := h.channelRepo.FindOrgChannelByName(org.ID, name); err == nil && ch != nil {
			_ = h.channelRepo.JoinChannel(ch.ID, user.ID)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Driver added successfully",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
		},
		"role": role,
	})
}

func (h *OrganizationHandler) RemoveMember(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	memberID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	org, _ := h.orgRepo.GetByID(orgID)
	if org != nil && org.OwnerID == memberID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove organization owner"})
		return
	}

	if err := h.orgRepo.RemoveUserFromOrg(memberID, orgID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

func (h *OrganizationHandler) UpdateMemberRole(c *gin.Context) {
	orgID, actorRole, ok := h.resolveOrgContext(c)
	if !ok || (actorRole != "owner" && actorRole != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	memberID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := req.Role
	if role != "driver" && role != "dispatcher" && role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	org, _ := h.orgRepo.GetByID(orgID)
	if org != nil && org.OwnerID == memberID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot change organization owner role"})
		return
	}

	currentRole, err := h.orgRepo.GetUserOrgRole(memberID, orgID)
	if err != nil || currentRole == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}
	if currentRole == "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot change owner role"})
		return
	}
	if actorRole == "admin" && (currentRole == "admin" || role == "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admins cannot promote/demote other admins"})
		return
	}

	if role == "driver" {
		count, _ := h.orgRepo.CountDrivers(orgID)
		if org != nil && count >= org.MaxDrivers && currentRole != "driver" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Driver limit reached for your plan"})
			return
		}
	}

	if err := h.orgRepo.AddUserToOrg(memberID, orgID, role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"userId": memberID, "role": role})
}

func (h *OrganizationHandler) GetFleet(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
		return
	}

	userIDs := make([]uuid.UUID, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.UserID)
	}

	locations, err := h.locRepo.GetLatestLocationsForUsers(userIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get locations"})
		return
	}

	locByUser := make(map[uuid.UUID]models.ChannelLocation, len(locations))
	for _, loc := range locations {
		locByUser[loc.UserID] = loc
	}

	type fleetMember struct {
		models.UserOrganization
		Location *models.ChannelLocation `json:"location,omitempty"`
	}

	fleet := make([]fleetMember, 0, len(members))
	for _, m := range members {
		item := fleetMember{UserOrganization: m}
		if loc, ok := locByUser[m.UserID]; ok {
			locCopy := loc
			item.Location = &locCopy
		}
		fleet = append(fleet, item)
	}

	channels, _ := h.channelRepo.ListChannels()

	c.JSON(http.StatusOK, gin.H{
		"members":  fleet,
		"channels": channels,
	})
}

func (h *OrganizationHandler) Broadcast(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	if role != "owner" && role != "admin" && role != "dispatcher" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	var req struct {
		Message   string `json:"message" binding:"required"`
		ChannelID string `json:"channelId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	user, _ := h.userRepo.GetByID(userID)
	senderName := user.Username
	if user != nil && user.FirstName != "" {
		senderName = user.FirstName
	}

	payload := gin.H{
		"message":    req.Message,
		"senderId":   userID.String(),
		"senderName": senderName,
	}

	if req.ChannelID != "" {
		channelID, err := uuid.Parse(req.ChannelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
			return
		}
		members, err := h.channelRepo.GetChannelMembers(channelID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel members"})
			return
		}
		ids := make([]uuid.UUID, len(members))
		for i, m := range members {
			ids[i] = m.ID
		}
		payload["channelId"] = req.ChannelID
		socket.BroadcastToUsers(ids, "org.broadcast", payload)
	} else {
		members, err := h.orgRepo.GetOrgMembers(orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
			return
		}
		ids := make([]uuid.UUID, 0, len(members))
		for _, m := range members {
			if m.UserID != userID {
				ids = append(ids, m.UserID)
			}
		}
		socket.BroadcastToUsers(ids, "org.broadcast", payload)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Broadcast sent"})
}

func (h *OrganizationHandler) CheckSubdomain(c *gin.Context) {
	subdomain := c.Query("subdomain")
	if subdomain == "" || len(subdomain) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"available": false, "error": "Subdomain too short"})
		return
	}

	org, _ := h.orgRepo.GetBySubdomain(subdomain)
	c.JSON(http.StatusOK, gin.H{
		"available": org == nil,
		"subdomain": subdomain,
	})
}

func (h *OrganizationHandler) ListIndustryTemplates(c *gin.Context) {
	c.JSON(http.StatusOK, industry.ListTemplates())
}

func (h *OrganizationHandler) GetFareSettings(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"fareRatePerKm":        org.FareRatePerKm,
		"fareMinimum":          org.FareMinimum,
		"fareNightMultiplier":  org.FareNightMultiplier,
		"fareNightStart":       org.FareNightStart,
		"fareNightEnd":         org.FareNightEnd,
		"bookingEnabled":       org.BookingEnabled,
		"customerAppTitle":     org.CustomerAppTitle,
		"bookingUrl":           "/book/" + org.Subdomain,
		"autoDispatch":         org.AutoDispatch,
		"driverCreditFloorMmk": org.DriverCreditFloorMMK,
		"walletPaymentInfo":    org.WalletPaymentInfo,
		"demandCatalog":        repository.ParseDemandCatalog(org.DemandCatalogJSON),
	})
}

func (h *OrganizationHandler) UpdateFareSettings(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	var req models.UpdateFareSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	org, err := h.orgRepo.UpdateFareSettings(orgID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fare settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"fareRatePerKm":        org.FareRatePerKm,
		"fareMinimum":          org.FareMinimum,
		"fareNightMultiplier":  org.FareNightMultiplier,
		"fareNightStart":       org.FareNightStart,
		"fareNightEnd":         org.FareNightEnd,
		"bookingEnabled":       org.BookingEnabled,
		"customerAppTitle":     org.CustomerAppTitle,
		"bookingUrl":           "/book/" + org.Subdomain,
		"autoDispatch":         org.AutoDispatch,
		"driverCreditFloorMmk": org.DriverCreditFloorMMK,
		"walletPaymentInfo":    org.WalletPaymentInfo,
		"demandCatalog":        repository.ParseDemandCatalog(org.DemandCatalogJSON),
	})
}

func (h *OrganizationHandler) GetEnterpriseFeatures(c *gin.Context) {
	transcriptionReady := os.Getenv("OPENAI_API_KEY") != ""
	c.JSON(http.StatusOK, gin.H{
		"aiTranscription": gin.H{
			"available": transcriptionReady,
			"status":    map[bool]string{true: "ready", false: "enterprise_beta"}[transcriptionReady],
		},
		"sso": gin.H{
			"available": false,
			"providers": []string{"google", "microsoft", "okta"},
			"status":    "contact_sales",
		},
	})
}

func (h *OrganizationHandler) provisionIndustryChannels(industryID string, ownerID, orgID uuid.UUID) []gin.H {
	tpl, ok := industry.GetTemplate(industryID)
	if !ok {
		return nil
	}

	created := make([]gin.H, 0, len(tpl.Channels))
	for _, chTpl := range tpl.Channels {
		ch, err := h.channelRepo.CreateChannelForOrg(chTpl.Name, chTpl.Description, ownerID, &orgID)
		if err != nil {
			continue
		}
		if err := h.channelRepo.JoinChannelAsAdmin(ch.ID, ownerID); err != nil {
			continue
		}
		created = append(created, gin.H{
			"id":          ch.ID,
			"name":        ch.Name,
			"description": ch.Description,
		})
	}
	return created
}

func (h *OrganizationHandler) canManageChannels(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *OrganizationHandler) ListOrgChannels(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}
	_ = h.channelRepo.ClaimOrphanChannelsForOrg(orgID)
	channels, err := h.channelRepo.ListChannelsByOrg(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list channels"})
		return
	}
	c.JSON(http.StatusOK, channels)
}

func (h *OrganizationHandler) CreateOrgChannel(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)

	var req struct {
		Name        string   `json:"name" binding:"required"`
		Description string   `json:"description"`
		IsPrivate   bool     `json:"isPrivate"`
		MemberIDs   []string `json:"memberIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := h.channelRepo.CreateChannelForOrg(req.Name, req.Description, userID, &orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}
	_ = h.channelRepo.JoinChannelAsAdmin(ch.ID, userID)
	if req.IsPrivate {
		_ = h.channelRepo.SetChannelPrivate(ch.ID, true)
		ch.IsPrivate = true
	}
	for _, idStr := range req.MemberIDs {
		mid, err := uuid.Parse(idStr)
		if err != nil || mid == userID {
			continue
		}
		if _, err := h.orgRepo.GetUserOrgRole(mid, orgID); err != nil {
			continue
		}
		_ = h.channelRepo.JoinChannel(ch.ID, mid)
	}
	updated, _ := h.channelRepo.GetOrgChannel(orgID, ch.ID)
	if updated != nil {
		c.JSON(http.StatusCreated, updated)
		return
	}
	c.JSON(http.StatusCreated, ch)
}

func (h *OrganizationHandler) UpdateOrgChannel(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	if _, err := h.channelRepo.GetOrgChannel(orgID, channelID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	var req models.UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ch, err := h.channelRepo.UpdateChannel(channelID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update channel"})
		return
	}
	updated, _ := h.channelRepo.GetOrgChannel(orgID, ch.ID)
	if updated != nil {
		c.JSON(http.StatusOK, updated)
		return
	}
	c.JSON(http.StatusOK, ch)
}

func (h *OrganizationHandler) DeleteOrgChannel(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	_ = h.channelRepo.ClaimOrphanChannelsForOrg(orgID)
	// Notify members before DELETE (memberships cascade-remove)
	socket.BroadcastToChannel(channelID, "ptt.channel_deleted", gin.H{"channelId": channelID.String()})
	if err := h.channelRepo.DeleteOrgChannel(orgID, channelID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Channel deleted"})
}

func (h *OrganizationHandler) AddOrgChannelMember(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	if _, err := h.channelRepo.GetOrgChannel(orgID, channelID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	var req struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	memberID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	if _, err := h.orgRepo.GetUserOrgRole(memberID, orgID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not in this organization"})
		return
	}
	if err := h.channelRepo.JoinChannel(channelID, memberID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
		return
	}
	members, _ := h.channelRepo.GetMembersWithRole(channelID)
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *OrganizationHandler) RemoveOrgChannelMember(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	memberID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	if _, err := h.channelRepo.GetOrgChannel(orgID, channelID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if err := h.channelRepo.KickMember(channelID, memberID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

func (h *OrganizationHandler) GetOrgChannelMembers(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	if _, err := h.channelRepo.GetOrgChannel(orgID, channelID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	members, err := h.channelRepo.GetMembersWithRole(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load members"})
		return
	}
	c.JSON(http.StatusOK, members)
}

// EnsureMeCommsChannels creates/joins community channels for the signed-in driver:
// Drivers Community (peer chat/PTT) + Admin Support (drivers ↔ stand).
func (h *OrganizationHandler) EnsureMeCommsChannels(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)
	org, err := h.orgRepo.GetByID(orgID)
	if err != nil || org == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	driversCh := h.ensureCommunityChannel(orgID, org.OwnerID, userID, "Drivers Community", "org-community:drivers")
	supportCh := h.ensureCommunityChannel(orgID, org.OwnerID, userID, "Admin Support", "org-community:support")

	// Join legacy industry channels when present.
	for _, name := range []string{"Drivers On Duty", "Dispatch", "Emergency"} {
		if ch, err := h.channelRepo.FindOrgChannelByName(orgID, name); err == nil && ch != nil {
			_ = h.channelRepo.JoinChannel(ch.ID, userID)
		}
	}

	members, _ := h.orgRepo.GetOrgMembers(orgID)
	if driversCh != nil {
		_ = h.channelRepo.JoinChannel(driversCh.ID, userID)
		for _, m := range members {
			_ = h.channelRepo.JoinChannel(driversCh.ID, m.UserID)
		}
	}
	if supportCh != nil {
		_ = h.channelRepo.JoinChannel(supportCh.ID, userID)
		for _, m := range members {
			if m.Role == "owner" || m.Role == "admin" || m.Role == "dispatcher" || m.UserID == userID {
				_ = h.channelRepo.JoinChannel(supportCh.ID, m.UserID)
			}
		}
	}

	channels, err := h.channelRepo.GetUserChannels(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list channels"})
		return
	}
	c.JSON(http.StatusOK, channels)
}

func (h *OrganizationHandler) ensureCommunityChannel(
	orgID, ownerID, actorID uuid.UUID,
	name, marker string,
) *models.Channel {
	if existing, err := h.channelRepo.FindOrgChannelByMarker(orgID, marker); err == nil && existing != nil {
		_ = h.channelRepo.JoinChannelAsAdmin(existing.ID, ownerID)
		_ = h.channelRepo.JoinChannel(existing.ID, actorID)
		return existing
	}
	// Prefer renaming an existing same-named channel if marker is missing.
	if byName, err := h.channelRepo.FindOrgChannelByName(orgID, name); err == nil && byName != nil {
		_ = h.channelRepo.JoinChannelAsAdmin(byName.ID, ownerID)
		_ = h.channelRepo.JoinChannel(byName.ID, actorID)
		return byName
	}
	ch, err := h.channelRepo.CreateChannelForOrg(name, marker, ownerID, &orgID)
	if err != nil {
		return nil
	}
	_ = h.channelRepo.JoinChannelAsAdmin(ch.ID, ownerID)
	_ = h.channelRepo.JoinChannel(ch.ID, actorID)
	updated, _ := h.channelRepo.GetOrgChannel(orgID, ch.ID)
	if updated != nil {
		return updated
	}
	return ch
}

func (h *OrganizationHandler) EnsureDriverPTTChannel(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageChannels(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)
	driverID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}
	driverRole, err := h.orgRepo.GetUserOrgRole(driverID, orgID)
	if err != nil || driverRole != "driver" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not a driver in this organization"})
		return
	}

	if existing, err := h.channelRepo.FindDriverPTTChannel(orgID, driverID); err == nil && existing != nil {
		_ = h.channelRepo.JoinChannelAsAdmin(existing.ID, userID)
		_ = h.channelRepo.JoinChannel(existing.ID, driverID)
		socket.SendEvent(driverID, "ptt.direct_open", gin.H{
			"channelId":  existing.ID.String(),
			"fromUserId": userID.String(),
			"name":       existing.Name,
		})
		c.JSON(http.StatusOK, existing)
		return
	}

	driver, err := h.userRepo.GetByID(driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}
	name := "Driver · " + driver.FirstName
	if driver.FirstName == "" {
		name = "Driver · " + driver.Username
	}
	marker := "driver-ptt:" + driverID.String()
	ch, err := h.channelRepo.CreateChannelForOrg(name, marker, userID, &orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create driver PTT channel"})
		return
	}
	_ = h.channelRepo.SetChannelPrivate(ch.ID, true)
	_ = h.channelRepo.JoinChannelAsAdmin(ch.ID, userID)
	_ = h.channelRepo.JoinChannel(ch.ID, driverID)
	socket.SendEvent(driverID, "ptt.direct_open", gin.H{
		"channelId":  ch.ID.String(),
		"fromUserId": userID.String(),
		"name":       ch.Name,
	})
	updated, _ := h.channelRepo.GetOrgChannel(orgID, ch.ID)
	if updated != nil {
		c.JSON(http.StatusCreated, updated)
		return
	}
	ch.IsPrivate = true
	c.JSON(http.StatusCreated, ch)
}
