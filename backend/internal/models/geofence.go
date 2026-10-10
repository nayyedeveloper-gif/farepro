package models

import (
	"time"

	"github.com/google/uuid"
)

type GeofenceZone struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	OrgID        uuid.UUID  `json:"orgId" db:"org_id"`
	ChannelID    *uuid.UUID `json:"channelId,omitempty" db:"channel_id"`
	Name         string     `json:"name" db:"name"`
	Latitude     float64    `json:"latitude" db:"latitude"`
	Longitude    float64    `json:"longitude" db:"longitude"`
	RadiusMeters float64    `json:"radiusMeters" db:"radius_meters"`
	AlertOn      string     `json:"alertOn" db:"alert_on"` // enter, exit, both
	Color        string     `json:"color" db:"color"`
	IsActive     bool       `json:"isActive" db:"is_active"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}

type GeofenceAlert struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ZoneID    uuid.UUID `json:"zoneId" db:"zone_id"`
	OrgID     uuid.UUID `json:"orgId" db:"org_id"`
	ChannelID uuid.UUID `json:"channelId" db:"channel_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	EventType string    `json:"eventType" db:"event_type"` // enter, exit
	Latitude  float64   `json:"latitude" db:"latitude"`
	Longitude float64   `json:"longitude" db:"longitude"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	Zone      *GeofenceZone `json:"zone,omitempty"`
	User      *User     `json:"user,omitempty"`
}

type CreateGeofenceZoneRequest struct {
	Name         string  `json:"name" binding:"required,min=1,max=100"`
	Latitude     float64 `json:"latitude" binding:"required,gte=-90,lte=90"`
	Longitude    float64 `json:"longitude" binding:"required,gte=-180,lte=180"`
	RadiusMeters float64 `json:"radiusMeters" binding:"required,gte=20,lte=50000"`
	AlertOn      string  `json:"alertOn" binding:"required,oneof=enter exit both"`
	ChannelID    string  `json:"channelId,omitempty"`
	Color        string  `json:"color,omitempty" binding:"omitempty,hexcolor"`
}

type UpdateGeofenceZoneRequest struct {
	Name         *string  `json:"name,omitempty" binding:"omitempty,min=1,max=100"`
	Latitude     *float64 `json:"latitude,omitempty" binding:"omitempty,gte=-90,lte=90"`
	Longitude    *float64 `json:"longitude,omitempty" binding:"omitempty,gte=-180,lte=180"`
	RadiusMeters *float64 `json:"radiusMeters,omitempty" binding:"omitempty,gte=20,lte=50000"`
	AlertOn      *string  `json:"alertOn,omitempty" binding:"omitempty,oneof=enter exit both"`
	Color        *string  `json:"color,omitempty" binding:"omitempty,hexcolor"`
	IsActive     *bool    `json:"isActive,omitempty"`
}
