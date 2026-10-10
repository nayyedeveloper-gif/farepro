package handlers

import (
	"errors"
	"log"
	"sort"
	"sync"
	"telegram-clone/internal/models"
	"telegram-clone/internal/services"
	"telegram-clone/internal/socket"
	"time"

	"github.com/google/uuid"
)

const (
	offerTimeout      = 30 * time.Second
	locationFreshness = 15 * time.Minute
	maxOffersPerTrip  = 8
)

var (
	ErrDispatchActive   = errors.New("trip is already being offered to drivers")
	ErrNoEligibleDriver = errors.New("no available driver with live GPS and enough wallet credit")
	ErrTripNotOpen      = errors.New("trip is not open for assignment")
	ErrNoPickupGPS      = errors.New("pickup GPS required for auto-dispatch")
)

type dispatchOffer struct {
	orgID     uuid.UUID
	tried     map[uuid.UUID]bool
	current   uuid.UUID
	expiresAt time.Time
	timer     *time.Timer
}

type driverCandidate struct {
	UserID uuid.UUID
	Km     float64
}

// DispatchQueue offers an open trip to the nearest eligible driver, moving to
// the next driver on decline or after offerTimeout. State is in-memory: after a
// restart, an outstanding offer simply stays assigned until the driver responds.
type DispatchQueue struct {
	h      *TripHandler
	mu     sync.Mutex
	offers map[uuid.UUID]*dispatchOffer
}

func NewDispatchQueue(h *TripHandler) *DispatchQueue {
	return &DispatchQueue{h: h, offers: map[uuid.UUID]*dispatchOffer{}}
}

// Start begins offering tripID. Returns the trip as offered and the driver distance.
func (q *DispatchQueue) Start(orgID, tripID uuid.UUID) (*models.Trip, float64, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if _, ok := q.offers[tripID]; ok {
		return nil, 0, ErrDispatchActive
	}
	trip, err := q.h.tripRepo.GetByID(orgID, tripID)
	if err != nil || trip == nil {
		return nil, 0, ErrTripNotOpen
	}
	if trip.Status != "pending" && trip.Status != "requested" {
		return nil, 0, ErrTripNotOpen
	}
	if trip.PickupLat == nil || trip.PickupLng == nil {
		return nil, 0, ErrNoPickupGPS
	}
	offer := &dispatchOffer{orgID: orgID, tried: map[uuid.UUID]bool{}}
	q.offers[tripID] = offer
	updated, km, err := q.offerNextLocked(tripID, offer, trip)
	if err != nil {
		delete(q.offers, tripID)
		return nil, 0, err
	}
	return updated, km, nil
}

// Active reports whether a trip is currently being auto-offered.
func (q *DispatchQueue) Active(tripID uuid.UUID) bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	_, ok := q.offers[tripID]
	return ok
}

// ExpiresAt returns the offer deadline if driverID holds the current offer.
func (q *DispatchQueue) ExpiresAt(tripID, driverID uuid.UUID) *time.Time {
	q.mu.Lock()
	defer q.mu.Unlock()
	if o, ok := q.offers[tripID]; ok && o.current == driverID {
		t := o.expiresAt
		return &t
	}
	return nil
}

// Stop ends auto-offering (driver accepted, dispatcher took over, trip cancelled).
func (q *DispatchQueue) Stop(tripID uuid.UUID) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if o, ok := q.offers[tripID]; ok {
		if o.timer != nil {
			o.timer.Stop()
		}
		delete(q.offers, tripID)
	}
}

// Declined moves to the next driver after the current one rejected the offer.
// The trip has already been returned to its open status by RejectTrip.
func (q *DispatchQueue) Declined(tripID uuid.UUID) {
	q.mu.Lock()
	defer q.mu.Unlock()
	offer, ok := q.offers[tripID]
	if !ok {
		return
	}
	if offer.timer != nil {
		offer.timer.Stop()
	}
	trip, err := q.h.tripRepo.GetByID(offer.orgID, tripID)
	if err != nil || trip == nil || (trip.Status != "pending" && trip.Status != "requested") {
		delete(q.offers, tripID)
		return
	}
	q.advanceLocked(tripID, offer, trip)
}

func (q *DispatchQueue) onTimeout(tripID, driverID uuid.UUID) {
	q.mu.Lock()
	defer q.mu.Unlock()
	offer, ok := q.offers[tripID]
	if !ok || offer.current != driverID {
		return
	}
	trip, err := q.h.tripRepo.GetByID(offer.orgID, tripID)
	if err != nil || trip == nil || trip.Status != "assigned" || trip.DriverID == nil || *trip.DriverID != driverID {
		delete(q.offers, tripID)
		return
	}
	trip.DriverID = nil
	trip.Status = openStatusFor(trip)
	if err := q.h.tripRepo.Update(trip); err != nil {
		log.Printf("dispatch: release expired offer %s: %v", tripID, err)
		delete(q.offers, tripID)
		return
	}
	socket.BroadcastToUsers([]uuid.UUID{driverID}, "trip.offer_expired", map[string]string{"tripId": tripID.String()})
	q.advanceLocked(tripID, offer, trip)
}

// advanceLocked offers to the next driver or gives up and alerts dispatchers.
func (q *DispatchQueue) advanceLocked(tripID uuid.UUID, offer *dispatchOffer, trip *models.Trip) {
	if _, _, err := q.offerNextLocked(tripID, offer, trip); err != nil {
		delete(q.offers, tripID)
		q.h.broadcastTrip(offer.orgID, *trip)
		go q.h.notifyDispatchers(offer.orgID, *trip, "No driver accepted", "Assign "+trip.CustomerName+" manually", "trip.dispatch_failed")
	}
}

func (q *DispatchQueue) offerNextLocked(tripID uuid.UUID, offer *dispatchOffer, trip *models.Trip) (*models.Trip, float64, error) {
	if len(offer.tried) >= maxOffersPerTrip {
		return nil, 0, ErrNoEligibleDriver
	}
	candidates, err := q.h.rankDrivers(offer.orgID, *trip.PickupLat, *trip.PickupLng, offer.tried)
	if err != nil {
		return nil, 0, err
	}
	if len(candidates) == 0 {
		return nil, 0, ErrNoEligibleDriver
	}
	best := candidates[0]

	trip.DriverID = &best.UserID
	trip.Status = "assigned"
	if err := q.h.tripRepo.Update(trip); err != nil {
		return nil, 0, err
	}
	offer.tried[best.UserID] = true
	offer.current = best.UserID
	offer.expiresAt = time.Now().Add(offerTimeout)
	driverID := best.UserID
	offer.timer = time.AfterFunc(offerTimeout, func() { q.onTimeout(tripID, driverID) })

	updated, err := q.h.tripRepo.GetByID(offer.orgID, tripID)
	if err != nil || updated == nil {
		updated = trip
	}
	expires := offer.expiresAt
	updated.OfferExpiresAt = &expires
	q.h.broadcastTrip(offer.orgID, *updated)
	socket.BroadcastToUsers([]uuid.UUID{driverID}, "trip.offer", map[string]interface{}{
		"trip":       updated,
		"expiresAt":  expires,
		"seconds":    int(offerTimeout.Seconds()),
		"distanceKm": mathRound(best.Km),
	})
	go q.h.notifyDriverAssigned(driverID, *updated)
	return updated, best.Km, nil
}

func openStatusFor(trip *models.Trip) string {
	if trip.BookingSource == "customer" {
		return "requested"
	}
	return "pending"
}

// rankDrivers returns eligible drivers nearest-first.
func (h *TripHandler) rankDrivers(orgID uuid.UUID, pickupLat, pickupLng float64, exclude map[uuid.UUID]bool) ([]driverCandidate, error) {
	if h.locRepo == nil {
		return nil, errors.New("location service unavailable")
	}
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		return nil, err
	}
	driverIDs := make([]uuid.UUID, 0)
	for _, m := range members {
		if m.Role == "driver" && !exclude[m.UserID] {
			driverIDs = append(driverIDs, m.UserID)
		}
	}
	if len(driverIDs) == 0 {
		return nil, nil
	}

	busy, err := h.tripRepo.BusyDriverIDs(orgID)
	if err != nil {
		return nil, err
	}
	floor := -5000
	if org, err := h.orgRepo.GetByID(orgID); err == nil && org != nil {
		floor = org.DriverCreditFloorMMK
	}
	balances := map[uuid.UUID]int{}
	if h.driverRepo != nil {
		if b, err := h.driverRepo.WalletBalances(orgID); err == nil {
			balances = b
		}
	}

	locations, err := h.locRepo.GetLatestLocationsForUsers(driverIDs)
	if err != nil {
		return nil, err
	}
	cutoff := time.Now().Add(-locationFreshness)
	out := make([]driverCandidate, 0, len(locations))
	for _, loc := range locations {
		if busy[loc.UserID] || loc.UpdatedAt.Before(cutoff) {
			continue
		}
		if loc.Status == "busy" || loc.Status == "off" || loc.Status == "dnd" {
			continue
		}
		if balances[loc.UserID] < floor {
			continue
		}
		out = append(out, driverCandidate{
			UserID: loc.UserID,
			Km:     services.HaversineKm(pickupLat, pickupLng, loc.Latitude, loc.Longitude),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Km < out[j].Km })
	return out, nil
}
