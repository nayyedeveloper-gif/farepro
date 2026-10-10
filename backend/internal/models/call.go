package models

import (
	"time"

	"github.com/google/uuid"
)

type Call struct {
	ID              uuid.UUID         `json:"id" db:"id"`
	ConversationID  uuid.UUID         `json:"conversationId" db:"conversation_id"`
	InitiatedBy     uuid.UUID         `json:"initiatedBy" db:"initiated_by"`
	CallType        string            `json:"callType" db:"call_type"`
	LiveKitRoomName string            `json:"livekitRoomName" db:"livekit_room_name"`
	Status          string            `json:"status" db:"status"`
	CallResult      string            `json:"callResult,omitempty" db:"call_result"`
	StartedAt       time.Time         `json:"startedAt" db:"started_at"`
	EndedAt         *time.Time        `json:"endedAt,omitempty" db:"ended_at"`
	Participants    []CallParticipant `json:"participants,omitempty"`
	Initiator       *User             `json:"initiator,omitempty"`
	OtherUser       *User             `json:"otherUser,omitempty"`
}

type CallHistoryItem struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	ConversationID  uuid.UUID  `json:"conversationId" db:"conversation_id"`
	InitiatedBy     uuid.UUID  `json:"initiatedBy" db:"initiated_by"`
	CallType        string     `json:"callType" db:"call_type"`
	LiveKitRoomName string     `json:"livekitRoomName" db:"livekit_room_name"`
	Status          string     `json:"status" db:"status"`
	CallResult      string     `json:"callResult" db:"call_result"`
	StartedAt       time.Time  `json:"startedAt" db:"started_at"`
	EndedAt         *time.Time `json:"endedAt,omitempty" db:"ended_at"`
	OtherUserID     uuid.UUID  `json:"otherUserId" db:"other_user_id"`
	OtherUsername   string     `json:"otherUsername" db:"other_username"`
	OtherFirstName  string     `json:"otherFirstName" db:"other_first_name"`
	OtherLastName   string     `json:"otherLastName" db:"other_last_name"`
	OtherAvatarURL  string     `json:"otherAvatarUrl" db:"other_avatar_url"`
	OtherPhone      string     `json:"otherPhone" db:"other_phone"`
}

type Notification struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Type      string    `json:"type" db:"type"`
	Title     string    `json:"title" db:"title"`
	Body      string    `json:"body" db:"body"`
	Data      string    `json:"data,omitempty" db:"data"`
	IsRead    bool      `json:"isRead" db:"is_read"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type CallParticipant struct {
	ID       uuid.UUID  `json:"id" db:"id"`
	CallID   uuid.UUID  `json:"callId" db:"call_id"`
	UserID   uuid.UUID  `json:"userId" db:"user_id"`
	JoinedAt *time.Time `json:"joinedAt,omitempty" db:"joined_at"`
	LeftAt   *time.Time `json:"leftAt,omitempty" db:"left_at"`
}

type InitiateCallRequest struct {
	ConversationID string `json:"conversationId" binding:"required"`
	CallType       string `json:"callType" binding:"required,oneof=audio video"`
}

type DialCallRequest struct {
	Phone    string `json:"phone" binding:"required"`
	CallType string `json:"callType" binding:"required,oneof=audio video"`
}

type CallTokenRequest struct {
	RoomName string `json:"roomName" binding:"required"`
	Identity string `json:"identity"`
}
