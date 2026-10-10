package models

import (
	"time"

	"github.com/google/uuid"
)

type Trip struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	OrgID          uuid.UUID  `json:"orgId" db:"org_id"`
	ChannelID      *uuid.UUID `json:"channelId,omitempty" db:"channel_id"`
	DriverID       *uuid.UUID `json:"driverId,omitempty" db:"driver_id"`
	CustomerID     *uuid.UUID `json:"customerId,omitempty" db:"customer_id"`
	CreatedBy      uuid.UUID  `json:"createdBy" db:"created_by"`
	CustomerName   string     `json:"customerName" db:"customer_name"`
	PickupAddress  string     `json:"pickupAddress" db:"pickup_address"`
	DropoffAddress string     `json:"dropoffAddress" db:"dropoff_address"`
	PickupLat      *float64   `json:"pickupLat,omitempty" db:"pickup_lat"`
	PickupLng      *float64   `json:"pickupLng,omitempty" db:"pickup_lng"`
	DropoffLat     *float64   `json:"dropoffLat,omitempty" db:"dropoff_lat"`
	DropoffLng     *float64   `json:"dropoffLng,omitempty" db:"dropoff_lng"`
	Status         string     `json:"status" db:"status"`
	Notes          string     `json:"notes,omitempty" db:"notes"`
	CustomerPhone  string     `json:"customerPhone,omitempty" db:"customer_phone"`
	DistanceKm     *float64   `json:"distanceKm,omitempty" db:"distance_km"`
	EstimatedFare  *int       `json:"estimatedFare,omitempty" db:"estimated_fare"`
	ActualFare     *int       `json:"actualFare,omitempty" db:"actual_fare"`
	PaymentMethod  string     `json:"paymentMethod,omitempty" db:"payment_method"`
	BookingSource  string     `json:"bookingSource,omitempty" db:"booking_source"`
	ServiceType    string     `json:"serviceType" db:"service_type"`
	VehicleType    string     `json:"vehicleType" db:"vehicle_type"`
	ParcelNotes    string     `json:"parcelNotes,omitempty" db:"parcel_notes"`
	DriverLat      *float64   `json:"driverLat,omitempty" db:"driver_lat"`
	DriverLng      *float64   `json:"driverLng,omitempty" db:"driver_lng"`
	DriverLocationAt *time.Time `json:"driverLocationAt,omitempty" db:"driver_location_at"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" db:"updated_at"`
	Driver         *User      `json:"driver,omitempty"`
	OfferExpiresAt *time.Time `json:"offerExpiresAt,omitempty" db:"-"`
}

// Service types: taxi (passenger rides) vs delivery (parcels).
// Delivery vehicles: motorcycle | bicycle | car. Taxi uses car.

func NormalizeServiceType(s string) string {
	if s == "delivery" {
		return "delivery"
	}
	return "taxi"
}

func NormalizeVehicleType(service, vehicle string) string {
	if NormalizeServiceType(service) == "delivery" {
		switch vehicle {
		case "motorcycle", "bicycle", "car":
			return vehicle
		default:
			return "motorcycle"
		}
	}
	return "car"
}

type CreateTripRequest struct {
	CustomerName   string   `json:"customerName" binding:"required"`
	PickupAddress  string   `json:"pickupAddress" binding:"required"`
	DropoffAddress string   `json:"dropoffAddress" binding:"required"`
	PickupLat      *float64 `json:"pickupLat,omitempty"`
	PickupLng      *float64 `json:"pickupLng,omitempty"`
	DropoffLat     *float64 `json:"dropoffLat,omitempty"`
	DropoffLng     *float64 `json:"dropoffLng,omitempty"`
	DriverID       string   `json:"driverId,omitempty"`
	ChannelID      string   `json:"channelId,omitempty"`
	Notes          string   `json:"notes,omitempty"`
	CustomerPhone  string   `json:"customerPhone,omitempty"`
	DistanceKm     *float64 `json:"distanceKm,omitempty"`
	PaymentMethod  string   `json:"paymentMethod,omitempty"`
	BookingSource  string   `json:"bookingSource,omitempty"`
	ServiceType    string   `json:"serviceType,omitempty"`
	VehicleType    string   `json:"vehicleType,omitempty"`
	ParcelNotes    string   `json:"parcelNotes,omitempty"`
}

type UpdateTripRequest struct {
	Status         *string  `json:"status,omitempty"`
	DriverID       *string  `json:"driverId,omitempty"`
	CustomerName   *string  `json:"customerName,omitempty"`
	PickupAddress  *string  `json:"pickupAddress,omitempty"`
	DropoffAddress *string  `json:"dropoffAddress,omitempty"`
	Notes          *string  `json:"notes,omitempty"`
	ActualFare     *int     `json:"actualFare,omitempty"`
	DistanceKm     *float64 `json:"distanceKm,omitempty"`
	PaymentMethod  *string  `json:"paymentMethod,omitempty"`
}

type AssignTripRequest struct {
	DriverID string `json:"driverId" binding:"required"`
}

type UpdateTripLocationRequest struct {
	Lat float64 `json:"lat" binding:"required"`
	Lng float64 `json:"lng" binding:"required"`
}
