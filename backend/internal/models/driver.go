package models

import (
	"time"

	"github.com/google/uuid"
)

// DriverProfile holds taxi-company-specific driver + vehicle details.
type DriverProfile struct {
	ID           uuid.UUID `json:"id" db:"id"`
	OrgID        uuid.UUID `json:"orgId" db:"org_id"`
	UserID       uuid.UUID `json:"userId" db:"user_id"`
	VehiclePlate string    `json:"vehiclePlate" db:"vehicle_plate"`
	VehicleModel string    `json:"vehicleModel" db:"vehicle_model"`
	VehicleColor string    `json:"vehicleColor" db:"vehicle_color"`
	LicenseNo    string    `json:"licenseNo" db:"license_no"`
	NRC          string    `json:"nrc" db:"nrc"`
	Notes        string    `json:"notes,omitempty" db:"notes"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

type DriverWallet struct {
	ID         uuid.UUID `json:"id" db:"id"`
	OrgID      uuid.UUID `json:"orgId" db:"org_id"`
	UserID     uuid.UUID `json:"userId" db:"user_id"`
	BalanceMMK int       `json:"balanceMmk" db:"balance_mmk"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}

type DriverWalletLedger struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	WalletID  uuid.UUID  `json:"walletId" db:"wallet_id"`
	OrgID     uuid.UUID  `json:"orgId" db:"org_id"`
	UserID    uuid.UUID  `json:"userId" db:"user_id"`
	AmountMMK int        `json:"amountMmk" db:"amount_mmk"`
	EntryType string     `json:"entryType" db:"entry_type"` // credit | debit | adjust
	Reason    string     `json:"reason,omitempty" db:"reason"`
	CreatedBy *uuid.UUID `json:"createdBy,omitempty" db:"created_by"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
}

type UpdateDriverProfileRequest struct {
	VehiclePlate string `json:"vehiclePlate"`
	VehicleModel string `json:"vehicleModel"`
	VehicleColor string `json:"vehicleColor"`
	LicenseNo    string `json:"licenseNo"`
	NRC          string `json:"nrc"`
	Notes        string `json:"notes"`
}

type AdjustDriverWalletRequest struct {
	AmountMMK int    `json:"amountMmk" binding:"required"`
	EntryType string `json:"entryType"` // credit | debit | adjust — default adjust
	Reason    string `json:"reason"`
}

// DriverRosterItem is the owner-portal driver card payload.
type DriverRosterItem struct {
	Membership   UserOrganization `json:"membership"`
	Profile      *DriverProfile   `json:"profile,omitempty"`
	Wallet       *DriverWallet    `json:"wallet,omitempty"`
	ActiveTrips  int              `json:"activeTrips"`
	CompletedTrips int            `json:"completedTrips"`
	CancelledTrips int            `json:"cancelledTrips"`
}

var TopupMethods = map[string]bool{"kbzpay": true, "wavepay": true, "ayapay": true, "cbpay": true, "cash": true, "bank": true}

type DriverTopupRequest struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	OrgID      uuid.UUID  `json:"orgId" db:"org_id"`
	UserID     uuid.UUID  `json:"userId" db:"user_id"`
	DriverName string     `json:"driverName" db:"driver_name"`
	Phone      string     `json:"phone" db:"phone"`
	AmountMMK  int        `json:"amountMmk" db:"amount_mmk"`
	Method     string     `json:"method" db:"method"`
	Reference  string     `json:"reference" db:"reference"`
	Note       string     `json:"note" db:"note"`
	Status     string     `json:"status" db:"status"`
	ReviewNote string     `json:"reviewNote" db:"review_note"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty" db:"reviewed_at"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
}

type CreateTopupRequest struct {
	AmountMMK int    `json:"amountMmk" binding:"required,min=500,max=10000000"`
	Method    string `json:"method" binding:"required"`
	Reference string `json:"reference" binding:"max=100"`
	Note      string `json:"note" binding:"max=500"`
}

type ReviewTopupRequest struct {
	Note string `json:"note" binding:"max=500"`
}
