package handlers

import (
	"net/http"
	"strings"
	"telegram-clone/internal/config"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
)

type TripCommsHandler struct {
	tripRepo    *repository.TripRepository
	tripMsgRepo *repository.TripMessageRepository
	orgRepo     *repository.OrganizationRepository
	liveKit     config.LiveKitConfig
}

func NewTripCommsHandler(
	tripRepo *repository.TripRepository,
	tripMsgRepo *repository.TripMessageRepository,
	orgRepo *repository.OrganizationRepository,
	liveKit config.LiveKitConfig,
) *TripCommsHandler {
	return &TripCommsHandler{tripRepo: tripRepo, tripMsgRepo: tripMsgRepo, orgRepo: orgRepo, liveKit: liveKit}
}

func (h *TripCommsHandler) tripRoomName(tripID uuid.UUID) string {
	return "trip-" + tripID.String()
}

func (h *TripCommsHandler) liveKitToken(room, identity string) (string, error) {
	at := auth.NewAccessToken(h.liveKit.APIKey, h.liveKit.APISecret)
	canPub := true
	canSub := true
	at.SetVideoGrant(&auth.VideoGrant{
		RoomJoin: true, Room: room, CanPublish: &canPub, CanSubscribe: &canSub,
	}).SetIdentity(identity).SetValidFor(3600)
	return at.ToJWT()
}

func (h *TripCommsHandler) verifyDriverTrip(c *gin.Context) (uuid.UUID, uuid.UUID, *models.Trip, bool) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return uuid.Nil, uuid.Nil, nil, false
	}
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return uuid.Nil, uuid.Nil, nil, false
	}
	userID := c.MustGet("userID").(uuid.UUID)
	trip, err := h.tripRepo.GetByID(orgID, tripID)
	if err != nil || trip.DriverID == nil || *trip.DriverID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return uuid.Nil, uuid.Nil, nil, false
	}
	return orgID, userID, trip, true
}

func (h *TripCommsHandler) verifyCustomerTrip(c *gin.Context, subdomain string) (*models.Organization, *models.Trip, bool) {
	org, err := h.orgRepo.GetBySubdomain(strings.ToLower(strings.TrimSpace(subdomain)))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return nil, nil, false
	}
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return nil, nil, false
	}
	phone := strings.TrimSpace(c.Query("phone"))
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "phone query required"})
		return nil, nil, false
	}
	trip, err := h.tripRepo.GetPublicByID(org.ID, tripID, phone)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return nil, nil, false
	}
	return org, trip, true
}

func (h *TripCommsHandler) resolveOrg(c *gin.Context) (uuid.UUID, string, bool) {
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

func (h *TripCommsHandler) broadcastTripMessage(trip models.Trip, msg models.TripMessage) {
	payload := gin.H{"tripId": trip.ID.String(), "message": msg}
	var ids []uuid.UUID
	if trip.DriverID != nil {
		ids = append(ids, *trip.DriverID)
	}
	members, _ := h.orgRepo.GetOrgMembers(trip.OrgID)
	for _, m := range members {
		if m.Role == "dispatcher" || m.Role == "owner" || m.Role == "admin" {
			ids = append(ids, m.UserID)
		}
	}
	if len(ids) > 0 {
		socket.BroadcastToUsers(ids, "trip.message", payload)
	}
}

func (h *TripCommsHandler) ListMessages(c *gin.Context) {
	_, _, trip, ok := h.verifyDriverTrip(c)
	if !ok {
		return
	}
	msgs, err := h.tripMsgRepo.ListByTrip(trip.ID, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load messages"})
		return
	}
	c.JSON(http.StatusOK, msgs)
}

func (h *TripCommsHandler) SendMessage(c *gin.Context) {
	_, userID, trip, ok := h.verifyDriverTrip(c)
	if !ok {
		return
	}
	if trip.Status == "completed" || trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip is closed"})
		return
	}
	var req models.SendTripMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	msg := &models.TripMessage{
		ID: uuid.New(), TripID: trip.ID, SenderRole: "driver",
		SenderUserID: &userID, Body: strings.TrimSpace(req.Body),
	}
	if err := h.tripMsgRepo.Create(msg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send"})
		return
	}
	h.broadcastTripMessage(*trip, *msg)
	c.JSON(http.StatusCreated, msg)
}

func (h *TripCommsHandler) CustomerListMessages(c *gin.Context) {
	_, trip, ok := h.verifyCustomerTrip(c, c.Param("subdomain"))
	if !ok {
		return
	}
	msgs, err := h.tripMsgRepo.ListByTrip(trip.ID, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load messages"})
		return
	}
	c.JSON(http.StatusOK, msgs)
}

func (h *TripCommsHandler) CustomerSendMessage(c *gin.Context) {
	_, trip, ok := h.verifyCustomerTrip(c, c.Param("subdomain"))
	if !ok {
		return
	}
	if trip.Status == "completed" || trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip is closed"})
		return
	}
	var req models.SendTripMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	msg := &models.TripMessage{
		ID: uuid.New(), TripID: trip.ID, SenderRole: "customer", Body: strings.TrimSpace(req.Body),
	}
	if err := h.tripMsgRepo.Create(msg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send"})
		return
	}
	h.broadcastTripMessage(*trip, *msg)
	c.JSON(http.StatusCreated, msg)
}

func (h *TripCommsHandler) DriverCallToken(c *gin.Context) {
	_, userID, trip, ok := h.verifyDriverTrip(c)
	if !ok {
		return
	}
	if trip.Status == "completed" || trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Call not available"})
		return
	}
	room := h.tripRoomName(trip.ID)
	token, err := h.liveKitToken(room, "driver-"+userID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "url": h.liveKit.URL, "roomName": room})
}

func (h *TripCommsHandler) CustomerCallToken(c *gin.Context) {
	_, trip, ok := h.verifyCustomerTrip(c, c.Param("subdomain"))
	if !ok {
		return
	}
	if trip.Status == "completed" || trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Call not available"})
		return
	}
	room := h.tripRoomName(trip.ID)
	token, err := h.liveKitToken(room, "customer-"+trip.CustomerPhone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "url": h.liveKit.URL, "roomName": room})
}

func (h *TripCommsHandler) TripHistory(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)
	trips, err := h.tripRepo.ListHistoryForDriver(userID, 30)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load history"})
		return
	}
	_ = orgID
	c.JSON(http.StatusOK, trips)
}

func (h *TripCommsHandler) CancelTrip(c *gin.Context) {
	orgID, userID, trip, ok := h.verifyDriverTrip(c)
	if !ok {
		return
	}
	var req models.CancelTripRequest
	_ = c.ShouldBindJSON(&req)
	updated, err := h.tripRepo.CancelByDriver(trip.ID, orgID, userID, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel this trip"})
		return
	}
	socket.BroadcastToUsers([]uuid.UUID{userID}, "trip.updated", updated)
	c.JSON(http.StatusOK, updated)
}

func (h *TripCommsHandler) FleetMap(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}
	drivers, _ := h.tripRepo.FleetDrivers(orgID)
	heat, _ := h.tripRepo.DemandHeat(orgID)
	c.JSON(http.StatusOK, models.FleetMapResponse{Drivers: drivers, Heat: heat})
}
