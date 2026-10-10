package models

import (
	"time"

	"github.com/google/uuid"
)

type ChannelMessage struct {
	ID             uuid.UUID       `json:"id" db:"id"`
	ChannelID      uuid.UUID       `json:"channelId" db:"channel_id"`
	SenderID       uuid.UUID       `json:"senderId" db:"sender_id"`
	Content        string          `json:"content,omitempty" db:"content"`
	Type           string          `json:"type" db:"type"` // text, image, file, emergency
	FileURL        string          `json:"fileUrl,omitempty" db:"file_url"`
	FileName       string          `json:"fileName,omitempty" db:"file_name"`
	FileSize       int64           `json:"fileSize,omitempty" db:"file_size"`
	ReplyToID      *uuid.UUID      `json:"replyToId,omitempty" db:"reply_to_id"`
	ForwardedFrom  *uuid.UUID      `json:"forwardedFromId,omitempty" db:"forwarded_from"`
	IsDeleted      bool            `json:"isDeleted" db:"is_deleted"`
	CreatedAt      time.Time       `json:"createdAt" db:"created_at"`
	Sender         *User           `json:"sender,omitempty"`
	ReplyToMessage *ChannelMessage `json:"replyToMessage,omitempty"`
	ForwardedUser  *User           `json:"forwardedUser,omitempty"`
	Reactions      []Reaction      `json:"reactions,omitempty"`
}

type Reaction struct {
	ID        uuid.UUID `json:"id" db:"id"`
	MessageID uuid.UUID `json:"messageId" db:"message_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Emoji     string    `json:"emoji" db:"emoji"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	User      *User     `json:"user,omitempty"`
}

type SendChannelMessageRequest struct {
	Content       string `json:"content,omitempty"`
	Type          string `json:"type"`
	FileURL       string `json:"fileUrl,omitempty"`
	FileName      string `json:"fileName,omitempty"`
	FileSize      int64  `json:"fileSize,omitempty"`
	ReplyToID     string `json:"replyToId,omitempty"`
	ForwardedFrom string `json:"forwardedFromId,omitempty"`
}

type ReactionRequest struct {
	Emoji string `json:"emoji" binding:"required"`
}
