package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Conversation struct {
	ID           uuid.UUID      `json:"id" db:"id"`
	Type         string         `json:"type" db:"type"`
	Name         string         `json:"name,omitempty" db:"name"`
	AvatarURL    string         `json:"avatarUrl,omitempty" db:"avatar_url"`
	Description  sql.NullString `json:"-" db:"description"`
	CreatedBy    uuid.UUID      `json:"createdBy" db:"created_by"`
	CreatedAt    time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time      `json:"updatedAt" db:"updated_at"`
	Participants []User         `json:"participants,omitempty"`
	LastMessage  *Message       `json:"lastMessage,omitempty"`
	UnreadCount  int            `json:"unreadCount"`
}

// Custom MarshalJSON to output sql.NullString as plain string
func (c Conversation) MarshalJSON() ([]byte, error) {
	type Alias Conversation // prevent recursion
	description := ""
	if c.Description.Valid {
		description = c.Description.String
	}
	return json.Marshal(&struct {
		Description string `json:"description,omitempty"`
		*Alias
	}{
		Description: description,
		Alias:       (*Alias)(&c),
	})
}

type Message struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	ConversationID uuid.UUID  `json:"conversationId" db:"conversation_id"`
	SenderID       uuid.UUID  `json:"senderId" db:"sender_id"`
	Content        string     `json:"content,omitempty" db:"content"`
	MessageType    string     `json:"messageType" db:"message_type"`
	FileURL        string     `json:"fileUrl,omitempty" db:"file_url"`
	Duration       *int       `json:"duration,omitempty" db:"duration"`
	ReplyToID      *uuid.UUID `json:"replyToId,omitempty" db:"reply_to_id"`
	ForwardedFrom  *uuid.UUID `json:"forwardedFrom,omitempty" db:"forwarded_from"`
	IsEdited       bool       `json:"isEdited" db:"is_edited"`
	IsDeleted      bool       `json:"isDeleted" db:"is_deleted"`
	IsPinned       bool       `json:"isPinned" db:"is_pinned"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" db:"updated_at"`
	Sender         *User      `json:"sender,omitempty"`
	ReplyToMessage *Message   `json:"replyToMessage,omitempty"`
	ForwardedUser  *User      `json:"forwardedUser,omitempty"`
}

type CreateConversationRequest struct {
	Type           string   `json:"type" binding:"required"`
	Name           string   `json:"name,omitempty"`
	Description    string   `json:"description,omitempty"`
	ParticipantIDs []string `json:"participantIds"`
}

type JoinChannelRequest struct {
	ChannelID string `json:"channelId" binding:"required"`
}

type AddMemberRequest struct {
	ConversationID string   `json:"conversationId" binding:"required"`
	UserIDs        []string `json:"userIds" binding:"required"`
}

type UpdateConversationRequest struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
}

type SendMessageRequest struct {
	Content       string `json:"content,omitempty"`
	MessageType   string `json:"messageType"`
	FileURL       string `json:"fileUrl,omitempty"`
	Duration      *int   `json:"duration,omitempty"`
	ReplyToID     string `json:"replyToId,omitempty"`
	ForwardedFrom string `json:"forwardedFrom,omitempty"`
}

type UpdateMessageRequest struct {
	Content string `json:"content" binding:"required"`
}
