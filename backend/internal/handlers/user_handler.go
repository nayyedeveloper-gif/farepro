package handlers

import (
	"net/http"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userRepo *repository.UserRepository
}

func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
}

func (h *UserHandler) SearchUsers(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)

	users, err := h.userRepo.Search(query, userID, 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

func (h *UserHandler) GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.userRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.FirstName = req.FirstName
	user.LastName = req.LastName
	user.Bio = req.Bio
	if phone := strings.TrimSpace(req.Phone); phone != "" {
		user.Phone = phone
	}

	if err := h.userRepo.Update(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateAvatar(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req struct {
		AvatarURL string `json:"avatarUrl" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.AvatarURL = req.AvatarURL

	if err := h.userRepo.Update(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update avatar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatarUrl": user.AvatarURL})
}

func (h *UserHandler) AddContact(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req struct {
		ContactID string `json:"contactId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	contactID, err := uuid.Parse(req.ContactID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contact ID"})
		return
	}

	if contactID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot add yourself as contact"})
		return
	}

	if err := h.userRepo.AddContact(userID, contactID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add contact"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contact added"})
}

func (h *UserHandler) GetContacts(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	contacts, err := h.userRepo.GetContacts(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get contacts"})
		return
	}

	c.JSON(http.StatusOK, contacts)
}

func (h *UserHandler) RemoveContact(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	contactID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contact ID"})
		return
	}

	if err := h.userRepo.RemoveContact(userID, contactID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove contact"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contact removed"})
}
