package models

import (
	"time"

	"github.com/google/uuid"
)

type Organization struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Subdomain   string     `json:"subdomain" db:"subdomain"`
	Plan        string     `json:"plan" db:"plan"` // free, pro, enterprise
	MaxDrivers  int        `json:"maxDrivers" db:"max_drivers"`
	MaxChannels int        `json:"maxChannels" db:"max_channels"`
	OwnerID     uuid.UUID  `json:"ownerId" db:"owner_id"`
	Industry    string     `json:"industry" db:"industry"`
	LogoURL     string     `json:"logoUrl,omitempty" db:"logo_url"`
	IsActive    bool       `json:"isActive" db:"is_active"`
	FareRatePerKm       int     `json:"fareRatePerKm" db:"fare_rate_per_km"`
	FareMinimum         int     `json:"fareMinimum" db:"fare_minimum"`
	FareNightMultiplier float64 `json:"fareNightMultiplier" db:"fare_night_multiplier"`
	FareNightStart      int     `json:"fareNightStart" db:"fare_night_start"`
	FareNightEnd        int     `json:"fareNightEnd" db:"fare_night_end"`
	BookingEnabled      bool    `json:"bookingEnabled" db:"booking_enabled"`
	CustomerAppTitle    string  `json:"customerAppTitle,omitempty" db:"customer_app_title"`
	BillingBalanceMMK   int     `json:"billingBalanceMmk" db:"billing_balance_mmk"`
	AutoDispatch         bool   `json:"autoDispatch" db:"auto_dispatch"`
	DriverCreditFloorMMK int    `json:"driverCreditFloorMmk" db:"driver_credit_floor_mmk"`
	WalletPaymentInfo    string `json:"walletPaymentInfo" db:"wallet_payment_info"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
}

type OrgBillingLedger struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	OrgID     uuid.UUID  `json:"orgId" db:"org_id"`
	AmountMMK int        `json:"amountMmk" db:"amount_mmk"`
	EntryType string     `json:"entryType" db:"entry_type"` // credit, debit, adjust
	Reason    string     `json:"reason" db:"reason"`
	CreatedBy *uuid.UUID `json:"createdBy,omitempty" db:"created_by"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
}

type PlatformOrgSummary struct {
	ID                uuid.UUID `json:"id" db:"id"`
	Name              string    `json:"name" db:"name"`
	Subdomain         string    `json:"subdomain" db:"subdomain"`
	Plan              string    `json:"plan" db:"plan"`
	Industry          string    `json:"industry" db:"industry"`
	IsActive          bool      `json:"isActive" db:"is_active"`
	MaxDrivers        int       `json:"maxDrivers" db:"max_drivers"`
	DriverCount       int       `json:"driverCount" db:"driver_count"`
	TripCount         int       `json:"tripCount" db:"trip_count"`
	BillingBalanceMMK int       `json:"billingBalanceMmk" db:"billing_balance_mmk"`
	OwnerName         string    `json:"ownerName" db:"owner_name"`
	OwnerPhone        string    `json:"ownerPhone" db:"owner_phone"`
	OnlineDrivers     int       `json:"onlineDrivers" db:"online_drivers"`
	CreatedAt         time.Time `json:"createdAt" db:"created_at"`
}

type PlatformCreateStandRequest struct {
	CreateOrganizationRequest
	Plan       string `json:"plan,omitempty"`
	MaxDrivers int    `json:"maxDrivers,omitempty"`
}

type PlatformTopupRequest struct {
	AmountMMK int    `json:"amountMmk" binding:"required"`
	Reason    string `json:"reason,omitempty"`
}

type PlatformSetPlanRequest struct {
	Plan       string `json:"plan" binding:"required"`
	MaxDrivers *int   `json:"maxDrivers,omitempty"`
	IsActive   *bool  `json:"isActive,omitempty"`
}

type UserOrganization struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	UserID         uuid.UUID  `json:"userId" db:"user_id"`
	OrganizationID uuid.UUID  `json:"organizationId" db:"organization_id"`
	Role           string     `json:"role" db:"role"` // owner, admin, dispatcher, driver
	JoinedAt       time.Time  `json:"joinedAt" db:"joined_at"`
	User           *User      `json:"user,omitempty"`
	Organization   *Organization `json:"organization,omitempty"`
}

type CreateOrganizationRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=100"`
	Subdomain   string `json:"subdomain" binding:"required,min=2,max=50"`
	OwnerName   string `json:"ownerName" binding:"required,min=2"`
	OwnerPhone  string `json:"ownerPhone" binding:"required"`
	Password    string `json:"password" binding:"required,min=6"`
	Industry    string `json:"industry,omitempty"`
}

type OrgLoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type InviteDriverRequest struct {
	Phone     string `json:"phone" binding:"required"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
	Role      string `json:"role,omitempty"` // driver, dispatcher, admin
}

type UpdateOrgRequest struct {
	Name     string `json:"name,omitempty"`
	LogoURL  string `json:"logoUrl,omitempty"`
	Plan     string `json:"plan,omitempty"`
}

type UpdateFareSettingsRequest struct {
	FareRatePerKm       *int     `json:"fareRatePerKm,omitempty"`
	FareMinimum         *int     `json:"fareMinimum,omitempty"`
	FareNightMultiplier *float64 `json:"fareNightMultiplier,omitempty"`
	FareNightStart      *int     `json:"fareNightStart,omitempty"`
	FareNightEnd        *int     `json:"fareNightEnd,omitempty"`
	BookingEnabled      *bool    `json:"bookingEnabled,omitempty"`
	CustomerAppTitle    *string  `json:"customerAppTitle,omitempty"`
	AutoDispatch         *bool   `json:"autoDispatch,omitempty"`
	DriverCreditFloorMMK *int    `json:"driverCreditFloorMmk,omitempty" binding:"omitempty,lte=0,gte=-1000000"`
	WalletPaymentInfo    *string `json:"walletPaymentInfo,omitempty" binding:"omitempty,max=1000"`
}

type FareEstimateRequest struct {
	PickupLat   *float64 `json:"pickupLat,omitempty"`
	PickupLng   *float64 `json:"pickupLng,omitempty"`
	DropoffLat  *float64 `json:"dropoffLat,omitempty"`
	DropoffLng  *float64 `json:"dropoffLng,omitempty"`
	DistanceKm  *float64 `json:"distanceKm,omitempty"`
}

type FareEstimateResponse struct {
	DistanceKm    float64 `json:"distanceKm"`
	DurationMin   float64 `json:"durationMin"`
	RouteSource   string  `json:"routeSource"`
	EstimatedFare int     `json:"estimatedFare"`
	Currency      string  `json:"currency"`
	RatePerKm     int     `json:"ratePerKm"`
	MinimumFare   int     `json:"minimumFare"`
}

type CustomerBookingRequest struct {
	CustomerName   string   `json:"customerName" binding:"required,min=1,max=100"`
	CustomerPhone  string   `json:"customerPhone" binding:"required,min=6,max=20"`
	PickupAddress  string   `json:"pickupAddress" binding:"required"`
	DropoffAddress string   `json:"dropoffAddress" binding:"required"`
	PickupLat      *float64 `json:"pickupLat,omitempty"`
	PickupLng      *float64 `json:"pickupLng,omitempty"`
	DropoffLat     *float64 `json:"dropoffLat,omitempty"`
	DropoffLng     *float64 `json:"dropoffLng,omitempty"`
	DistanceKm     *float64 `json:"distanceKm,omitempty"`
	PaymentMethod  string   `json:"paymentMethod,omitempty"`
}

type PublicOrgInfo struct {
	Name             string `json:"name"`
	Subdomain        string `json:"subdomain"`
	LogoURL          string `json:"logoUrl,omitempty"`
	CustomerAppTitle string `json:"customerAppTitle,omitempty"`
	BookingEnabled   bool   `json:"bookingEnabled"`
	FareRatePerKm    int    `json:"fareRatePerKm"`
	FareMinimum      int    `json:"fareMinimum"`
	Currency         string `json:"currency"`
}
