package handlers

import (
	"math"
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

type BookingHandler struct {
	tripRepo     *repository.TripRepository
	orgRepo      *repository.OrganizationRepository
	customerRepo *repository.CustomerRepository
	notifier     *NotificationHandler
	autoDispatch func(org *models.Organization, trip *models.Trip)
}

// WithAutoDispatch lets new customer bookings enter the driver offer queue.
func (h *BookingHandler) WithAutoDispatch(fn func(org *models.Organization, trip *models.Trip)) *BookingHandler {
	h.autoDispatch = fn
	return h
}

func NewBookingHandler(
	tripRepo *repository.TripRepository,
	orgRepo *repository.OrganizationRepository,
	customerRepo *repository.CustomerRepository,
	notifier *NotificationHandler,
) *BookingHandler {
	return &BookingHandler{
		tripRepo:     tripRepo,
		orgRepo:      orgRepo,
		customerRepo: customerRepo,
		notifier:     notifier,
	}
}

func fareInputFromOrg(org *models.Organization) services.FareInput {
	return services.FareInput{
		RatePerKm:       org.FareRatePerKm,
		MinimumFare:     org.FareMinimum,
		NightMultiplier: org.FareNightMultiplier,
		NightStartHour:  org.FareNightStart,
		NightEndHour:    org.FareNightEnd,
	}
}

func resolveRoute(req models.FareEstimateRequest) (services.RouteResult, bool) {
	if req.PickupLat != nil && req.PickupLng != nil && req.DropoffLat != nil && req.DropoffLng != nil {
		return services.EstimateRoute(*req.PickupLat, *req.PickupLng, *req.DropoffLat, *req.DropoffLng, false), true
	}
	if req.DistanceKm != nil && *req.DistanceKm > 0 {
		km := *req.DistanceKm
		return services.RouteResult{DistanceKm: km, DurationMin: math.Round(km / 22 * 60), Source: "manual"}, true
	}
	return services.RouteResult{}, false
}

func computeFare(org *models.Organization, req models.FareEstimateRequest) (*models.FareEstimateResponse, bool) {
	route, ok := resolveRoute(req)
	if !ok {
		return nil, false
	}
	fare := services.CalculateFare(route.DistanceKm, time.Now(), fareInputFromOrg(org))
	return &models.FareEstimateResponse{
		DistanceKm:    route.DistanceKm,
		DurationMin:   route.DurationMin,
		RouteSource:   route.Source,
		EstimatedFare: fare,
		Currency:      "MMK",
		RatePerKm:     org.FareRatePerKm,
		MinimumFare:   org.FareMinimum,
	}, true
}

// RoutePreview returns road geometry + ETA between two points for map drawing.
func (h *BookingHandler) RoutePreview(c *gin.Context) {
	if _, err := h.loadOrg(c.Param("subdomain")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return
	}
	respondRoute(c)
}

func respondRoute(c *gin.Context) {
	parse := func(name string) (float64, bool) {
		v, err := strconv.ParseFloat(c.Query(name), 64)
		return v, err == nil && !math.IsNaN(v) && math.Abs(v) <= 180
	}
	fromLat, ok1 := parse("fromLat")
	fromLng, ok2 := parse("fromLng")
	toLat, ok3 := parse("toLat")
	toLng, ok4 := parse("toLng")
	if !ok1 || !ok2 || !ok3 || !ok4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fromLat, fromLng, toLat, toLng required"})
		return
	}
	c.JSON(http.StatusOK, services.EstimateRoute(fromLat, fromLng, toLat, toLng, true))
}

// OrgRoutePreview is the authenticated equivalent for dispatch consoles.
func OrgRoutePreview(c *gin.Context) {
	respondRoute(c)
}

func (h *BookingHandler) loadOrg(subdomain string) (*models.Organization, error) {
	subdomain = strings.ToLower(strings.TrimSpace(subdomain))
	return h.orgRepo.GetBySubdomain(subdomain)
}

func (h *BookingHandler) GetPublicOrg(c *gin.Context) {
	org, err := h.loadOrg(c.Param("subdomain"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return
	}
	title := org.CustomerAppTitle
	if title == "" {
		title = org.Name
	}
	c.JSON(http.StatusOK, models.PublicOrgInfo{
		Name:             org.Name,
		Subdomain:        org.Subdomain,
		LogoURL:          org.LogoURL,
		CustomerAppTitle: title,
		BookingEnabled:   org.BookingEnabled,
		FareRatePerKm:    org.FareRatePerKm,
		FareMinimum:      org.FareMinimum,
		Currency:         "MMK",
	})
}

func (h *BookingHandler) EstimateFare(c *gin.Context) {
	org, err := h.loadOrg(c.Param("subdomain"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return
	}
	var req models.FareEstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	estimate, ok := computeFare(org, req)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide GPS coordinates or distanceKm"})
		return
	}
	c.JSON(http.StatusOK, estimate)
}

func (h *BookingHandler) notifyDispatchers(orgID uuid.UUID, trip models.Trip) {
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
	if len(ids) == 0 {
		return
	}
	socket.BroadcastToUsers(ids, "trip.updated", trip)
	if h.notifier != nil {
		for _, id := range ids {
			h.notifier.NotifyUser(
				id,
				"trip.requested",
				"New ride request",
				trip.PickupAddress,
				"/dispatch",
				"trip-"+trip.ID.String(),
				map[string]interface{}{"tripId": trip.ID.String()},
			)
		}
	}
}

func (h *BookingHandler) CreateBooking(c *gin.Context) {
	org, err := h.loadOrg(c.Param("subdomain"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return
	}
	if !org.BookingEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Online booking is not available"})
		return
	}

	var req models.CustomerBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	estimateReq := models.FareEstimateRequest{
		PickupLat:  req.PickupLat,
		PickupLng:  req.PickupLng,
		DropoffLat: req.DropoffLat,
		DropoffLng: req.DropoffLng,
		DistanceKm: req.DistanceKm,
	}
	estimate, ok := computeFare(org, estimateReq)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide GPS coordinates or distanceKm for fare estimate"})
		return
	}

	payment := strings.TrimSpace(req.PaymentMethod)
	if payment == "" {
		payment = "cash"
	}

	distanceKm := estimate.DistanceKm
	estimatedFare := estimate.EstimatedFare
	trip := &models.Trip{
		ID:             uuid.New(),
		OrgID:          org.ID,
		CreatedBy:      org.OwnerID,
		CustomerName:   strings.TrimSpace(req.CustomerName),
		CustomerPhone:  strings.TrimSpace(req.CustomerPhone),
		PickupAddress:  strings.TrimSpace(req.PickupAddress),
		DropoffAddress: strings.TrimSpace(req.DropoffAddress),
		PickupLat:      req.PickupLat,
		PickupLng:      req.PickupLng,
		DropoffLat:     req.DropoffLat,
		DropoffLng:     req.DropoffLng,
		Status:         "requested",
		DistanceKm:     &distanceKm,
		EstimatedFare:  &estimatedFare,
		PaymentMethod:  payment,
		BookingSource:  "customer",
		ServiceType:    "taxi",
		VehicleType:    "car",
	}

	if trip.CustomerPhone != "" && h.customerRepo != nil {
		if cust, err := h.customerRepo.UpsertByPhone(org.ID, trip.CustomerName, trip.CustomerPhone); err == nil && cust != nil {
			trip.CustomerID = &cust.ID
		}
	}

	if err := h.tripRepo.Create(trip); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking"})
		return
	}

	created, _ := h.tripRepo.GetByID(org.ID, trip.ID)
	if created != nil {
		h.notifyDispatchers(org.ID, *created)
		if h.autoDispatch != nil {
			h.autoDispatch(org, created)
		}
		c.JSON(http.StatusCreated, created)
		return
	}
	c.JSON(http.StatusCreated, trip)
}

func (h *BookingHandler) GetBookingStatus(c *gin.Context) {
	org, err := h.loadOrg(c.Param("subdomain"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Taxi service not found"})
		return
	}
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}
	phone := strings.TrimSpace(c.Query("phone"))
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "phone query required"})
		return
	}
	trip, err := h.tripRepo.GetPublicByID(org.ID, tripID, phone)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	c.JSON(http.StatusOK, trip)
}
