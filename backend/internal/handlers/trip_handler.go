package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/services"
	"telegram-clone/internal/socket"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TripHandler struct {
	tripRepo     *repository.TripRepository
	orgRepo      *repository.OrganizationRepository
	userRepo     *repository.UserRepository
	customerRepo *repository.CustomerRepository
	driverRepo   *repository.DriverRepository
	locRepo      *repository.ChannelLocationRepository
	notifier     *NotificationHandler
	queue        *DispatchQueue
}

func NewTripHandler(
	tripRepo *repository.TripRepository,
	orgRepo *repository.OrganizationRepository,
	userRepo *repository.UserRepository,
	customerRepo *repository.CustomerRepository,
	notifier *NotificationHandler,
) *TripHandler {
	h := &TripHandler{
		tripRepo:     tripRepo,
		orgRepo:      orgRepo,
		userRepo:     userRepo,
		customerRepo: customerRepo,
		notifier:     notifier,
	}
	h.queue = NewDispatchQueue(h)
	return h
}

// Queue exposes the auto-offer queue so public bookings can auto-dispatch.
func (h *TripHandler) Queue() *DispatchQueue {
	return h.queue
}

// MaybeAutoDispatch starts offering an open trip when the stand enabled auto-dispatch.
func (h *TripHandler) MaybeAutoDispatch(org *models.Organization, trip *models.Trip) {
	if org == nil || trip == nil || !org.AutoDispatch || trip.DriverID != nil || trip.PickupLat == nil {
		return
	}
	orgID, tripID := org.ID, trip.ID
	go func() {
		if _, _, err := h.queue.Start(orgID, tripID); err != nil && err != ErrDispatchActive {
			log.Printf("auto-dispatch %s: %v", tripID, err)
		}
	}()
}

// WithDriverRepos wires wallet settlement + auto-dispatch location lookup.
func (h *TripHandler) WithDriverRepos(driverRepo *repository.DriverRepository, locRepo *repository.ChannelLocationRepository) *TripHandler {
	h.driverRepo = driverRepo
	h.locRepo = locRepo
	return h
}

func (h *TripHandler) settleTripCommission(orgID uuid.UUID, trip *models.Trip, actorID uuid.UUID) {
	if h.driverRepo == nil || trip == nil || trip.DriverID == nil {
		return
	}
	if trip.Status != "completed" {
		return
	}
	fare := 0
	if trip.ActualFare != nil {
		fare = *trip.ActualFare
	} else if trip.EstimatedFare != nil {
		fare = *trip.EstimatedFare
	}
	if fare <= 0 {
		return
	}
	// Stand commission: 10% of fare (min 200 MMK), debited from driver wallet.
	commission := fare / 10
	if commission < 200 {
		commission = 200
	}
	reason := "trip:" + trip.ID.String()
	exists, err := h.driverRepo.HasLedgerReason(orgID, reason)
	if err != nil || exists {
		return
	}
	if _, err := h.driverRepo.AdjustWallet(orgID, *trip.DriverID, actorID, commission, "commission", reason); err != nil {
		log.Printf("commission for trip %s: %v", trip.ID, err)
	}
}

func (h *TripHandler) notifyDriverAssigned(driverID uuid.UUID, trip models.Trip) {
	if h.notifier == nil {
		return
	}
	body := trip.PickupAddress
	if body == "" {
		body = "Open Work tab to accept or decline"
	}
	h.notifier.NotifyUser(
		driverID,
		"trip.assigned",
		"New job — accept?",
		body,
		"/app",
		"trip-"+trip.ID.String(),
		map[string]interface{}{"tripId": trip.ID.String()},
	)
}

func (h *TripHandler) notifyDispatchers(orgID uuid.UUID, trip models.Trip, title, body, eventType string) {
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil || h.notifier == nil {
		return
	}
	for _, m := range members {
		if m.Role != "owner" && m.Role != "admin" && m.Role != "dispatcher" {
			continue
		}
		h.notifier.NotifyUser(
			m.UserID,
			eventType,
			title,
			body,
			"/dispatch",
			"trip-"+trip.ID.String(),
			map[string]interface{}{"tripId": trip.ID.String()},
		)
	}
}

func (h *TripHandler) resolveOrgContext(c *gin.Context) (uuid.UUID, string, bool) {
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

func (h *TripHandler) canManageTrips(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *TripHandler) applyFareToTrip(trip *models.Trip, org *models.Organization, distanceKm *float64) {
	if distanceKm == nil || org == nil {
		return
	}
	fare := services.CalculateFare(*distanceKm, time.Now(), services.FareInput{
		RatePerKm:       org.FareRatePerKm,
		MinimumFare:     org.FareMinimum,
		NightMultiplier: org.FareNightMultiplier,
		NightStartHour:  org.FareNightStart,
		NightEndHour:    org.FareNightEnd,
	})
	trip.DistanceKm = distanceKm
	trip.EstimatedFare = &fare
}

func (h *TripHandler) broadcastTrip(orgID uuid.UUID, trip models.Trip) {
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		return
	}
	var ids []uuid.UUID
	for _, m := range members {
		if m.Role == "owner" || m.Role == "admin" || m.Role == "dispatcher" {
			ids = append(ids, m.UserID)
		}
	}
	if trip.DriverID != nil {
		ids = append(ids, *trip.DriverID)
	}
	if len(ids) == 0 {
		return
	}
	socket.BroadcastToUsers(ids, "trip.updated", trip)
}

func (h *TripHandler) ListTrips(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	status := c.Query("status")
	serviceType := c.Query("serviceType")
	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	userID := c.MustGet("userID").(uuid.UUID)
	if role == "driver" {
		trips, err := h.tripRepo.ListActiveForDriver(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list trips"})
			return
		}
		for i := range trips {
			if trips[i].Status == "assigned" {
				trips[i].OfferExpiresAt = h.queue.ExpiresAt(trips[i].ID, userID)
			}
		}
		c.JSON(http.StatusOK, trips)
		return
	}

	if !h.canManageTrips(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	trips, err := h.tripRepo.ListByOrgFiltered(orgID, status, serviceType, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list trips"})
		return
	}
	c.JSON(http.StatusOK, trips)
}

func (h *TripHandler) CreateTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageTrips(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	var req models.CreateTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	org, _ := h.orgRepo.GetByID(orgID)
	trip := &models.Trip{
		ID:             uuid.New(),
		OrgID:          orgID,
		CreatedBy:      userID,
		CustomerName:   req.CustomerName,
		PickupAddress:  req.PickupAddress,
		DropoffAddress: req.DropoffAddress,
		PickupLat:      req.PickupLat,
		PickupLng:      req.PickupLng,
		DropoffLat:     req.DropoffLat,
		DropoffLng:     req.DropoffLng,
		Status:         "pending",
		Notes:          req.Notes,
		CustomerPhone:  strings.TrimSpace(req.CustomerPhone),
		PaymentMethod:  "cash",
		BookingSource:  "dispatcher",
		ServiceType:    models.NormalizeServiceType(req.ServiceType),
		VehicleType:    models.NormalizeVehicleType(req.ServiceType, req.VehicleType),
		ParcelNotes:    strings.TrimSpace(req.ParcelNotes),
	}
	if req.PaymentMethod != "" {
		trip.PaymentMethod = req.PaymentMethod
	}
	if req.BookingSource != "" {
		trip.BookingSource = req.BookingSource
	}
	if req.DistanceKm != nil {
		h.applyFareToTrip(trip, org, req.DistanceKm)
	} else if req.PickupLat != nil && req.PickupLng != nil && req.DropoffLat != nil && req.DropoffLng != nil {
		km := services.EstimateRoute(*req.PickupLat, *req.PickupLng, *req.DropoffLat, *req.DropoffLng, false).DistanceKm
		h.applyFareToTrip(trip, org, &km)
	}

	if req.ChannelID != "" {
		chID, err := uuid.Parse(req.ChannelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
			return
		}
		trip.ChannelID = &chID
	}
	if req.DriverID != "" {
		driverID, err := uuid.Parse(req.DriverID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
			return
		}
		trip.DriverID = &driverID
		trip.Status = "assigned"
	}

	if trip.CustomerPhone != "" && h.customerRepo != nil {
		if cust, err := h.customerRepo.UpsertByPhone(orgID, trip.CustomerName, trip.CustomerPhone); err == nil && cust != nil {
			trip.CustomerID = &cust.ID
		}
	}

	if err := h.tripRepo.Create(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create trip"})
		return
	}

	created, _ := h.tripRepo.GetByID(orgID, trip.ID)
	if created != nil {
		h.broadcastTrip(orgID, *created)
		if created.DriverID != nil && created.Status == "assigned" {
			h.notifyDriverAssigned(*created.DriverID, *created)
		}
		h.MaybeAutoDispatch(org, created)
		c.JSON(http.StatusCreated, created)
		return
	}
	c.JSON(http.StatusCreated, trip)
}

func (h *TripHandler) UpdateTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	trip, err := h.tripRepo.GetByID(orgID, tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	var previousDriverID *uuid.UUID
	if trip.DriverID != nil {
		prev := *trip.DriverID
		previousDriverID = &prev
	}

	userID := c.MustGet("userID").(uuid.UUID)
	isDriver := role == "driver" && trip.DriverID != nil && *trip.DriverID == userID
	if !h.canManageTrips(role) && !isDriver {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	var req models.UpdateTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if isDriver {
		if req.Status == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status required"})
			return
		}
		allowed := map[string]bool{"en_route": true, "arrived": true, "completed": true}
		if !allowed[*req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status for driver"})
			return
		}
		trip.Status = *req.Status
		if *req.Status == "completed" {
			if req.ActualFare != nil {
				trip.ActualFare = req.ActualFare
			} else if trip.EstimatedFare != nil {
				trip.ActualFare = trip.EstimatedFare
			}
			if req.DistanceKm != nil {
				trip.DistanceKm = req.DistanceKm
			}
		}
	} else {
		if req.Status != nil || req.DriverID != nil {
			h.queue.Stop(tripID)
		}
		if req.Status != nil {
			trip.Status = *req.Status
		}
		if req.DriverID != nil {
			if *req.DriverID == "" {
				trip.DriverID = nil
			} else {
				driverID, err := uuid.Parse(*req.DriverID)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
					return
				}
				trip.DriverID = &driverID
				if trip.Status == "pending" || trip.Status == "requested" {
					trip.Status = "assigned"
				}
			}
		}
		if req.CustomerName != nil {
			trip.CustomerName = *req.CustomerName
		}
		if req.PickupAddress != nil {
			trip.PickupAddress = *req.PickupAddress
		}
		if req.DropoffAddress != nil {
			trip.DropoffAddress = *req.DropoffAddress
		}
		if req.Notes != nil {
			trip.Notes = *req.Notes
		}
	}

	if err := h.tripRepo.Update(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update trip"})
		return
	}

	updated, _ := h.tripRepo.GetByID(orgID, tripID)
	if updated != nil {
		if updated.Status == "completed" {
			h.settleTripCommission(orgID, updated, userID)
		}
		h.broadcastTrip(orgID, *updated)
		if updated.DriverID != nil && updated.Status == "assigned" {
			newDriverID := *updated.DriverID
			if previousDriverID == nil || *previousDriverID != newDriverID {
				h.notifyDriverAssigned(newDriverID, *updated)
			}
		}
		c.JSON(http.StatusOK, updated)
		return
	}
	c.JSON(http.StatusOK, trip)
}

func (h *TripHandler) AutoAssignTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageTrips(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}
	trip, km, err := h.queue.Start(orgID, tripID)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{
			"trip":         trip,
			"distanceKm":   mathRound(km),
			"offerSeconds": int(offerTimeout.Seconds()),
		})
	case errors.Is(err, ErrTripNotOpen), errors.Is(err, ErrNoPickupGPS):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, ErrDispatchActive), errors.Is(err, ErrNoEligibleDriver):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Auto-dispatch failed"})
	}
}

func mathRound(km float64) float64 {
	return float64(int(km*10+0.5)) / 10
}

func (h *TripHandler) AssignTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageTrips(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var req models.AssignTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driverID, err := uuid.Parse(req.DriverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	trip, err := h.tripRepo.GetByID(orgID, tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	h.queue.Stop(tripID)
	trip.DriverID = &driverID
	if trip.Status == "pending" || trip.Status == "requested" {
		trip.Status = "assigned"
	}
	if err := h.tripRepo.Update(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign trip"})
		return
	}

	updated, _ := h.tripRepo.GetByID(orgID, tripID)
	if updated != nil {
		h.broadcastTrip(orgID, *updated)
		h.notifyDriverAssigned(driverID, *updated)
		c.JSON(http.StatusOK, updated)
		return
	}
	c.JSON(http.StatusOK, trip)
}

func (h *TripHandler) AcceptTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	trip, err := h.tripRepo.GetByID(orgID, tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}
	if trip.DriverID == nil || *trip.DriverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Job not assigned to you"})
		return
	}
	if trip.Status != "assigned" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job is not awaiting acceptance"})
		return
	}

	trip.Status = "en_route"
	if err := h.tripRepo.Update(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept trip"})
		return
	}
	h.queue.Stop(tripID)

	updated, _ := h.tripRepo.GetByID(orgID, tripID)
	if updated != nil {
		h.broadcastTrip(orgID, *updated)
		h.notifyDispatchers(orgID, *updated, "Driver accepted job", updated.CustomerName+" is en route", "trip.accepted")
		c.JSON(http.StatusOK, updated)
		return
	}
	c.JSON(http.StatusOK, trip)
}

func (h *TripHandler) RejectTrip(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	trip, err := h.tripRepo.GetByID(orgID, tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}
	if trip.DriverID == nil || *trip.DriverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Job not assigned to you"})
		return
	}
	if trip.Status != "assigned" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job is not awaiting acceptance"})
		return
	}

	trip.DriverID = nil
	if trip.BookingSource == "customer" {
		trip.Status = "requested"
	} else {
		trip.Status = "pending"
	}
	if err := h.tripRepo.Update(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject trip"})
		return
	}

	if h.queue.Active(tripID) {
		go h.queue.Declined(tripID)
		c.JSON(http.StatusOK, gin.H{"id": tripID, "status": trip.Status})
		return
	}

	updated, _ := h.tripRepo.GetByID(orgID, tripID)
	if updated != nil {
		h.broadcastTrip(orgID, *updated)
		h.notifyDispatchers(orgID, *updated, "Driver declined job", "Reassign "+updated.CustomerName, "trip.rejected")
		c.JSON(http.StatusOK, updated)
		return
	}
	c.JSON(http.StatusOK, trip)
}

func (h *TripHandler) UpdateTripLocation(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var req models.UpdateTripLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	updated, err := h.tripRepo.UpdateDriverLocation(tripID, orgID, userID, req.Lat, req.Lng)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Active trip not found"})
		return
	}

	h.broadcastTrip(orgID, *updated)
	c.JSON(http.StatusOK, updated)
}

func (h *TripHandler) DailyReport(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok || !h.canManageTrips(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	day := strings.TrimSpace(c.Query("date"))
	if day != "" {
		if _, err := time.Parse("2006-01-02", day); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
			return
		}
	}
	report, err := h.tripRepo.DailyOpsReport(orgID, day)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load report"})
		return
	}
	c.JSON(http.StatusOK, report)
}
