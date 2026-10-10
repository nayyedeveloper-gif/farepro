package models

import (
	"time"

	"github.com/google/uuid"
)

type PTTRecording struct {
	ID                 uuid.UUID `json:"id" db:"id"`
	ChannelID          uuid.UUID `json:"channelId" db:"channel_id"`
	UserID             uuid.UUID `json:"userId" db:"user_id"`
	FileURL            string    `json:"fileUrl" db:"file_url"`
	DurationMs         int       `json:"durationMs" db:"duration_ms"`
	TranscriptionText  string    `json:"transcriptionText,omitempty" db:"transcription_text"`
	TranscriptionStatus string   `json:"transcriptionStatus,omitempty" db:"transcription_status"`
	CreatedAt          time.Time `json:"createdAt" db:"created_at"`
	User               *User     `json:"user,omitempty"`
}

type SavePTTRecordingRequest struct {
	FileURL    string `json:"fileUrl" binding:"required"`
	DurationMs int    `json:"durationMs"`
}
