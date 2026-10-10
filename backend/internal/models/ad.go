package models

import (
	"time"

	"github.com/google/uuid"
)

type Ad struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Type        string    `json:"type" db:"type"` // image, video, html
	ContentURL  string    `json:"contentUrl" db:"content_url"`
	TargetURL   string    `json:"targetUrl" db:"target_url"`
	Duration    int       `json:"duration" db:"duration"` // seconds
	IsActive    bool      `json:"isActive" db:"is_active"`
	StartDate   time.Time `json:"startDate" db:"start_date"`
	EndDate     time.Time `json:"endDate" db:"end_date"`
	Impressions int       `json:"impressions" db:"impressions"`
	Clicks      int       `json:"clicks" db:"clicks"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type AdAnalytics struct {
	AdID        uuid.UUID `json:"adId"`
	Impressions int       `json:"impressions"`
	Clicks      int       `json:"clicks"`
	CTR         float64   `json:"ctr"` // Click-through rate
}
