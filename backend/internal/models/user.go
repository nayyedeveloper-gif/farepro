package models

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusAvailable UserStatus = "available"
	UserStatusBusy      UserStatus = "busy"
	UserStatusDND       UserStatus = "dnd"
)

type User struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	Username        string     `json:"username" db:"username"`
	Email           string     `json:"email" db:"email"`
	PasswordHash    string     `json:"-" db:"password_hash"`
	Phone           string     `json:"phone,omitempty" db:"phone"`
	FirstName       string     `json:"firstName,omitempty" db:"first_name"`
	LastName        string     `json:"lastName,omitempty" db:"last_name"`
	AvatarURL       string     `json:"avatarUrl,omitempty" db:"avatar_url"`
	Bio             string     `json:"bio,omitempty" db:"bio"`
	IsOnline        bool       `json:"isOnline" db:"is_online"`
	Status          UserStatus `json:"status" db:"status"`
	IsPlatformAdmin bool       `json:"isPlatformAdmin,omitempty" db:"is_platform_admin"`
	LastSeen        *time.Time `json:"lastSeen,omitempty" db:"last_seen"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

type Contact struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	ContactID uuid.UUID `json:"contactId" db:"contact_id"`
	User      *User     `json:"user,omitempty"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type RegisterRequest struct {
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Phone     string `json:"phone" binding:"required"`
	Password  string `json:"password" binding:"required,min=6"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UpdateProfileRequest struct {
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
	Bio       string `json:"bio,omitempty"`
	Phone     string `json:"phone,omitempty"`
}
