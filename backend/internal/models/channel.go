package models

import (
	"time"

	"github.com/google/uuid"
)

type ChannelRole string

const (
	ChannelRoleAdmin  ChannelRole = "admin"
	ChannelRoleMember ChannelRole = "member"
)

type Channel struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	AvatarURL   string    `json:"avatarUrl,omitempty" db:"avatar_url"`
	IsPrivate   bool      `json:"isPrivate" db:"is_private"`
	InviteToken string    `json:"inviteToken,omitempty" db:"invite_token"`
	CreatedBy   uuid.UUID  `json:"createdBy" db:"created_by"`
	OrganizationID *uuid.UUID `json:"organizationId,omitempty" db:"organization_id"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
	Members     []User    `json:"members,omitempty"`
	MemberCount int       `json:"memberCount" db:"member_count"`
}

type ChannelMember struct {
	ChannelID uuid.UUID   `json:"channelId" db:"channel_id"`
	UserID    uuid.UUID   `json:"userId" db:"user_id"`
	Role      ChannelRole `json:"role" db:"role"`
	JoinedAt  time.Time   `json:"joinedAt" db:"joined_at"`
	User      *User       `json:"user,omitempty"`
}

type EmergencyAlert struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ChannelID uuid.UUID `json:"channelId" db:"channel_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	User      *User     `json:"user,omitempty"`
}

type CreateChannelRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description,omitempty"`
	IsPrivate   bool   `json:"isPrivate"`
}

type UpdateChannelRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AvatarURL   string `json:"avatarUrl"`
	IsPrivate   *bool  `json:"isPrivate"`
}

type UpdateChannelMemberRoleRequest struct {
	UserID string      `json:"userId" binding:"required"`
	Role   ChannelRole `json:"role" binding:"required"`
}
