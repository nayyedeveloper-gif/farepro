package models

import (
	"time"

	"github.com/google/uuid"
)

type TripMessage struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	TripID       uuid.UUID  `json:"tripId" db:"trip_id"`
	SenderRole   string     `json:"senderRole" db:"sender_role"`
	SenderUserID *uuid.UUID `json:"senderUserId,omitempty" db:"sender_user_id"`
	Body         string     `json:"body" db:"body"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}

type SendTripMessageRequest struct {
	Body string `json:"body" binding:"required"`
}

type FleetDriverPin struct {
	DriverID  uuid.UUID `json:"driverId" db:"driver_id"`
	FirstName string    `json:"firstName" db:"first_name"`
	LastName  string    `json:"lastName" db:"last_name"`
	Lat       float64   `json:"lat" db:"lat"`
	Lng       float64   `json:"lng" db:"lng"`
	Status    string    `json:"status" db:"status"`
	TripID    uuid.UUID `json:"tripId" db:"trip_id"`
}

type DemandHeatPoint struct {
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Weight int     `json:"weight"`
}

type FleetMapResponse struct {
	Drivers []FleetDriverPin  `json:"drivers"`
	Heat    []DemandHeatPoint `json:"heat"`
}

type DriverDaySettlement struct {
	DriverID       uuid.UUID `json:"driverId" db:"driver_id"`
	FirstName      string    `json:"firstName" db:"first_name"`
	LastName       string    `json:"lastName" db:"last_name"`
	Username       string    `json:"username" db:"username"`
	CompletedTrips int       `json:"completedTrips" db:"completed_trips"`
	FareTotal      int       `json:"fareTotal" db:"fare_total"`
	WalletBalance  int       `json:"walletBalance" db:"wallet_balance"`
}

type DailyOpsReport struct {
	Date           string                `json:"date"`
	TotalTrips     int                   `json:"totalTrips"`
	Completed      int                   `json:"completed"`
	Cancelled      int                   `json:"cancelled"`
	Active         int                   `json:"active"`
	FareTotal      int                   `json:"fareTotal"`
	Requested      int                   `json:"requested"`
	Drivers        []DriverDaySettlement `json:"drivers"`
}

type CancelTripRequest struct {
	Reason string `json:"reason"`
}
