package models

import (
	"time"

	"github.com/google/uuid"
)

type Customer struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	OrgID      uuid.UUID  `json:"orgId" db:"org_id"`
	Name       string     `json:"name" db:"name"`
	Phone      string     `json:"phone" db:"phone"`
	Notes      string     `json:"notes,omitempty" db:"notes"`
	TripCount  int        `json:"tripCount" db:"trip_count"`
	LastTripAt *time.Time `json:"lastTripAt,omitempty" db:"last_trip_at"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time  `json:"updatedAt" db:"updated_at"`
}

type CreateCustomerRequest struct {
	Name  string `json:"name" binding:"required"`
	Phone string `json:"phone" binding:"required"`
	Notes string `json:"notes"`
}

type UpdateCustomerRequest struct {
	Name  *string `json:"name,omitempty"`
	Phone *string `json:"phone,omitempty"`
	Notes *string `json:"notes,omitempty"`
}
