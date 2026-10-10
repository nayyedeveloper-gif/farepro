package models

import (
	"time"

	"github.com/google/uuid"
)

// StoryType represents the media type of the story
type StoryType string

const (
	StoryTypeText  StoryType = "text"
	StoryTypeImage StoryType = "image"
	StoryTypeVideo StoryType = "video"
	StoryTypeVoice StoryType = "voice"
)

// Story represents a user story (post/status)
type Story struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"userId" db:"user_id"`
	Type        StoryType  `json:"type" db:"type"`
	Content     string     `json:"content,omitempty" db:"content"`
	MediaURL    string     `json:"mediaUrl,omitempty" db:"media_url"`
	Duration    int        `json:"duration,omitempty" db:"duration"` // seconds for video/voice
	Caption     string     `json:"caption,omitempty" db:"caption"`
	ViewCount   int        `json:"viewCount" db:"view_count"`
	ExpiresAt   time.Time  `json:"expiresAt" db:"expires_at"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`

	// Joined fields
	User       *User `json:"user,omitempty"`
	IsViewed   bool  `json:"isViewed"`
}

// StoryView records who viewed a story
type StoryView struct {
	ID        uuid.UUID `json:"id" db:"id"`
	StoryID   uuid.UUID `json:"storyId" db:"story_id"`
	ViewerID  uuid.UUID `json:"viewerId" db:"viewer_id"`
	ViewedAt  time.Time `json:"viewedAt" db:"viewed_at"`
}

// CreateStoryRequest is the payload for creating a story
type CreateStoryRequest struct {
	Type     StoryType `json:"type" binding:"required"`
	Content  string    `json:"content,omitempty"`
	MediaURL string    `json:"mediaUrl,omitempty"`
	Duration int       `json:"duration,omitempty"`
	Caption  string    `json:"caption,omitempty"`
}
