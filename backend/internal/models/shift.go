package models

import (
	"time"

	"github.com/google/uuid"
)

type RetailShift struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	OrgID        uuid.UUID  `json:"orgId" db:"org_id"`
	UserID       uuid.UUID  `json:"userId" db:"user_id"`
	LocationName string     `json:"locationName" db:"location_name"`
	RoleLabel    string     `json:"roleLabel" db:"role_label"`
	Status       string     `json:"status" db:"status"` // active, completed
	ClockIn      time.Time  `json:"clockIn" db:"clock_in"`
	ClockOut     *time.Time `json:"clockOut,omitempty" db:"clock_out"`
	User         *User      `json:"user,omitempty"`
}

type ClockInRequest struct {
	LocationName string `json:"locationName" binding:"required,min=1,max=100"`
	RoleLabel    string `json:"roleLabel,omitempty"`
}
