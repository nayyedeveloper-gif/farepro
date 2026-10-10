package models

import (
	"time"

	"github.com/google/uuid"
)

type ChannelLocation struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ChannelID uuid.UUID `json:"channelId" db:"channel_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Latitude  float64   `json:"latitude" db:"latitude"`
	Longitude float64   `json:"longitude" db:"longitude"`
	Heading   float64   `json:"heading" db:"heading"`
	Speed     float64   `json:"speed" db:"speed"`
	Status    string    `json:"status" db:"status"` // available, busy, off
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
	User      *User     `json:"user,omitempty"`
}

type UpdateLocationRequest struct {
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	Heading   float64 `json:"heading"`
	Speed     float64 `json:"speed"`
	Status    string  `json:"status,omitempty"`
}

type LocationTrailPoint struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ChannelID uuid.UUID `json:"channelId" db:"channel_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Latitude  float64   `json:"latitude" db:"latitude"`
	Longitude float64   `json:"longitude" db:"longitude"`
	Heading   float64   `json:"heading" db:"heading"`
	Speed     float64   `json:"speed" db:"speed"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}
