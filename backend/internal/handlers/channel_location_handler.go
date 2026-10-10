package handlers

import (
	"log"
	"net/http"
	"strconv"

	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChannelLocationHandler struct {
	locRepo        *repository.ChannelLocationRepository
	channelRepo    *repository.ChannelRepository
	geofenceRepo   *repository.GeofenceRepository
	orgRepo        *repository.OrganizationRepository
	geofenceHandler *GeofenceHandler
}

func NewChannelLocationHandler(
	locRepo *repository.ChannelLocationRepository,
	channelRepo *repository.ChannelRepository,
	geofenceRepo *repository.GeofenceRepository,
	orgRepo *repository.OrganizationRepository,
	geofenceHandler *GeofenceHandler,
) *ChannelLocationHandler {
	return &ChannelLocationHandler{
		locRepo:         locRepo,
		channelRepo:     channelRepo,
		geofenceRepo:    geofenceRepo,
		orgRepo:         orgRepo,
		geofenceHandler: geofenceHandler,
	}
}

func (h *ChannelLocationHandler) UpdateLocation(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	var req models.UpdateLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "available"
	}

	loc := &models.ChannelLocation{
		ID:        uuid.New(),
		ChannelID: channelID,
		UserID:    userID,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Heading:   req.Heading,
		Speed:     req.Speed,
		Status:    req.Status,
	}

	if err := h.locRepo.UpsertLocation(loc); err != nil {
		log.Printf("[ChannelLocationHandler] UpsertLocation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update location"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	var memberIDs []uuid.UUID
	for _, m := range members {
		if m.ID != userID {
			memberIDs = append(memberIDs, m.ID)
		}
	}

	user, _ := h.channelRepo.GetChannelMembers(channelID)
	for i := range user {
		if user[i].ID == userID {
			loc.User = &user[i]
			break
		}
	}

	socket.BroadcastToUsers(memberIDs, "channel.location", loc)

	if h.geofenceRepo != nil && h.orgRepo != nil {
		orgs, err := h.orgRepo.GetUserOrganizations(userID)
		if err == nil && len(orgs) > 0 {
			alerts, err := h.geofenceRepo.ProcessLocationUpdate(
				orgs[0].OrganizationID, channelID, userID, req.Latitude, req.Longitude,
			)
			if err == nil && h.geofenceHandler != nil {
				h.geofenceHandler.BroadcastAlerts(alerts)
			}
		}
	}

	c.JSON(http.StatusOK, loc)
}

func (h *ChannelLocationHandler) GetLocations(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	locations, err := h.locRepo.GetChannelLocations(channelID)
	if err != nil {
		log.Printf("[ChannelLocationHandler] GetLocations error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get locations"})
		return
	}

	c.JSON(http.StatusOK, locations)
}

func (h *ChannelLocationHandler) ClearLocation(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if err := h.locRepo.DeleteLocation(channelID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear location"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	var memberIDs []uuid.UUID
	for _, m := range members {
		if m.ID != userID {
			memberIDs = append(memberIDs, m.ID)
		}
	}
	socket.BroadcastToUsers(memberIDs, "channel.location_cleared", gin.H{
		"channelId": channelID.String(),
		"userId":    userID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "Location cleared"})
}

func (h *ChannelLocationHandler) GetTrail(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	userID, err := uuid.Parse(c.Query("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid userId query param"})
		return
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	points, err := h.locRepo.GetLocationTrail(channelID, userID, limit)
	if err != nil {
		log.Printf("[ChannelLocationHandler] GetTrail error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get trail"})
		return
	}

	c.JSON(http.StatusOK, points)
}

func (h *ChannelLocationHandler) ClearTrail(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if err := h.locRepo.ClearTrail(channelID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear trail"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Trail cleared"})
}
