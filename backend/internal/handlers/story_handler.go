package handlers

import (
	"net/http"
	"time"

	"telegram-clone/internal/middleware"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StoryHandler struct {
	storyRepo *repository.StoryRepository
}

func NewStoryHandler(storyRepo *repository.StoryRepository) *StoryHandler {
	return &StoryHandler{storyRepo: storyRepo}
}

// POST /api/stories — create a story
func (h *StoryHandler) CreateStory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreateStoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type == models.StoryTypeText && req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content required for text stories"})
		return
	}
	if req.Type != models.StoryTypeText && req.MediaURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mediaUrl required for media stories"})
		return
	}

	story := &models.Story{
		ID:        uuid.New(),
		UserID:    userID,
		Type:      req.Type,
		Content:   req.Content,
		MediaURL:  req.MediaURL,
		Duration:  req.Duration,
		Caption:   req.Caption,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}

	if err := h.storyRepo.CreateStory(story); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create story"})
		return
	}

	// Broadcast new story event to all connected users
	socket.BroadcastToAll(socket.EventStoryNew, gin.H{"story": story})

	c.JSON(http.StatusCreated, gin.H{"story": story})
}

// GET /api/stories — get all active stories (for story tray)
func (h *StoryHandler) GetAllStories(c *gin.Context) {
	userID := middleware.GetUserID(c)

	stories, err := h.storyRepo.GetAllActiveStories(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stories"})
		return
	}

	// Group by user
	type UserStories struct {
		User    *models.User    `json:"user"`
		Stories []*models.Story `json:"stories"`
		HasNew  bool            `json:"hasNew"`
	}

	grouped := make(map[uuid.UUID]*UserStories)
	order := []uuid.UUID{}

	for _, s := range stories {
		if _, ok := grouped[s.UserID]; !ok {
			grouped[s.UserID] = &UserStories{User: s.User, Stories: []*models.Story{}}
			order = append(order, s.UserID)
		}
		grouped[s.UserID].Stories = append(grouped[s.UserID].Stories, s)
		if !s.IsViewed {
			grouped[s.UserID].HasNew = true
		}
	}

	result := make([]*UserStories, 0, len(order))
	for _, id := range order {
		result = append(result, grouped[id])
	}

	c.JSON(http.StatusOK, gin.H{"users": result})
}

// GET /api/stories/user/:userId — get stories for a specific user (profile view)
func (h *StoryHandler) GetUserStories(c *gin.Context) {
	viewerID := middleware.GetUserID(c)

	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	stories, err := h.storyRepo.GetActiveStoriesByUser(targetID, viewerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stories": stories})
}

// POST /api/stories/:id/view — mark story as viewed
func (h *StoryHandler) ViewStory(c *gin.Context) {
	viewerID := middleware.GetUserID(c)

	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story ID"})
		return
	}

	if err := h.storyRepo.RecordView(storyID, viewerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record view"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/stories/:id — delete own story
func (h *StoryHandler) DeleteStory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story ID"})
		return
	}

	if err := h.storyRepo.DeleteStory(storyID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Story not found or not yours"})
		return
	}

	socket.BroadcastToAll(socket.EventStoryDeleted, gin.H{"storyId": storyID})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
