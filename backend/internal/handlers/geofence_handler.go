package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type GeofenceHandler struct {
	geofenceRepo *repository.GeofenceRepository
	orgRepo      *repository.OrganizationRepository
	userRepo     *repository.UserRepository
	notifier     *NotificationHandler
}

func NewGeofenceHandler(
	geofenceRepo *repository.GeofenceRepository,
	orgRepo *repository.OrganizationRepository,
	userRepo *repository.UserRepository,
	notifier *NotificationHandler,
) *GeofenceHandler {
	return &GeofenceHandler{
		geofenceRepo: geofenceRepo,
		orgRepo:      orgRepo,
		userRepo:     userRepo,
		notifier:     notifier,
	}
}

func (h *GeofenceHandler) resolveOrgContext(c *gin.Context) (uuid.UUID, string, bool) {
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

func (h *GeofenceHandler) canManageZones(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *GeofenceHandler) canViewZones(role string) bool {
	return h.canManageZones(role)
}

func (h *GeofenceHandler) ListZones(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canViewZones(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	zones, err := h.geofenceRepo.ListZones(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list zones"})
		return
	}
	c.JSON(http.StatusOK, zones)
}

func (h *GeofenceHandler) CreateZone(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageZones(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	var req models.CreateGeofenceZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	zone := &models.GeofenceZone{
		ID:           uuid.New(),
		OrgID:        orgID,
		Name:         req.Name,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		RadiusMeters: req.RadiusMeters,
		AlertOn:      req.AlertOn,
		Color:        req.Color,
		IsActive:     true,
	}
	if zone.Color == "" {
		zone.Color = "#3b82f6"
	}
	if req.ChannelID != "" {
		channelID, err := uuid.Parse(req.ChannelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
			return
		}
		zone.ChannelID = &channelID
	}

	if err := h.geofenceRepo.CreateZone(zone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create zone"})
		return
	}
	c.JSON(http.StatusCreated, zone)
}

func (h *GeofenceHandler) UpdateZone(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageZones(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	zoneID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid zone ID"})
		return
	}

	zone, err := h.geofenceRepo.GetZone(orgID, zoneID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Zone not found"})
		return
	}

	var req models.UpdateGeofenceZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		zone.Name = *req.Name
	}
	if req.Latitude != nil {
		zone.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		zone.Longitude = *req.Longitude
	}
	if req.RadiusMeters != nil {
		zone.RadiusMeters = *req.RadiusMeters
	}
	if req.AlertOn != nil {
		zone.AlertOn = *req.AlertOn
	}
	if req.Color != nil {
		zone.Color = *req.Color
	}
	if req.IsActive != nil {
		zone.IsActive = *req.IsActive
	}

	if err := h.geofenceRepo.UpdateZone(zone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update zone"})
		return
	}
	c.JSON(http.StatusOK, zone)
}

func (h *GeofenceHandler) DeleteZone(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageZones(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	zoneID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid zone ID"})
		return
	}

	if err := h.geofenceRepo.DeleteZone(orgID, zoneID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete zone"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Zone deleted"})
}

func (h *GeofenceHandler) ListAlerts(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canViewZones(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	alerts, err := h.geofenceRepo.ListAlerts(orgID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list alerts"})
		return
	}
	c.JSON(http.StatusOK, alerts)
}

func (h *GeofenceHandler) BroadcastAlerts(alerts []models.GeofenceAlert) {
	if len(alerts) == 0 {
		return
	}

	orgID := alerts[0].OrgID
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		return
	}

	var recipientIDs []uuid.UUID
	for _, m := range members {
		if m.Role == "owner" || m.Role == "admin" || m.Role == "dispatcher" {
			recipientIDs = append(recipientIDs, m.UserID)
		}
	}
	if len(recipientIDs) == 0 {
		return
	}

	for _, alert := range alerts {
		user, _ := h.userRepo.GetByID(alert.UserID)
		if user != nil {
			alert.User = user
		}
		zoneName := "zone"
		if zone, err := h.geofenceRepo.GetZone(orgID, alert.ZoneID); err == nil && zone != nil {
			alert.Zone = zone
			zoneName = zone.Name
		}
		socket.BroadcastToUsers(recipientIDs, "geofence.alert", alert)

		if h.notifier == nil {
			continue
		}

		userName := "Driver"
		if user != nil {
			if user.FirstName != "" {
				userName = user.FirstName
			} else if user.Username != "" {
				userName = user.Username
			}
		}
		eventVerb := "entered"
		if alert.EventType == "exit" {
			eventVerb = "left"
		}
		title := fmt.Sprintf("Zone alert: %s", zoneName)
		body := fmt.Sprintf("%s %s %s", userName, eventVerb, zoneName)
		data := map[string]interface{}{
			"alertId":   alert.ID.String(),
			"zoneId":    alert.ZoneID.String(),
			"eventType": alert.EventType,
		}
		for _, recipientID := range recipientIDs {
			h.notifier.NotifyUser(
				recipientID,
				"geofence.alert",
				title,
				body,
				"/dispatch",
				"geofence-"+alert.ID.String(),
				data,
			)
		}
	}
}
