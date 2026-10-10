package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/google/uuid"
)

type QRSessionStatus string

const (
	QRStatusPending  QRSessionStatus = "pending"
	QRStatusApproved QRSessionStatus = "approved"
	QRStatusExpired  QRSessionStatus = "expired"
)

type QRSession struct {
	ID        uuid.UUID
	Token     string
	Status    QRSessionStatus
	UserID    *uuid.UUID
	JWT       string
	ExpiresAt time.Time
	CreatedAt time.Time
}

type QRStore struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]*QRSession
}

func NewQRStore() *QRStore {
	store := &QRStore{sessions: make(map[uuid.UUID]*QRSession)}
	go store.cleanupLoop()
	return store
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *QRStore) Create() (*QRSession, error) {
	token, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	session := &QRSession{
		ID:        uuid.New(),
		Token:     token,
		Status:    QRStatusPending,
		ExpiresAt: now.Add(2 * time.Minute),
		CreatedAt: now,
	}
	s.mu.Lock()
	s.sessions[session.ID] = session
	s.mu.Unlock()
	return session, nil
}

func (s *QRStore) Get(id uuid.UUID) (*QRSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, false
	}
	if session.Status == QRStatusPending && time.Now().After(session.ExpiresAt) {
		session.Status = QRStatusExpired
	}
	return session, true
}

func (s *QRStore) Approve(id uuid.UUID, token string, userID uuid.UUID, jwt string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return ErrQRSessionNotFound
	}
	if time.Now().After(session.ExpiresAt) {
		session.Status = QRStatusExpired
		return ErrQRSessionExpired
	}
	if session.Token != token {
		return ErrQRInvalidToken
	}
	if session.Status != QRStatusPending {
		return ErrQRSessionUsed
	}
	session.Status = QRStatusApproved
	session.UserID = &userID
	session.JWT = jwt
	return nil
}

func (s *QRStore) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		now := time.Now()
		s.mu.Lock()
		for id, session := range s.sessions {
			if now.After(session.ExpiresAt.Add(5 * time.Minute)) {
				delete(s.sessions, id)
			}
		}
		s.mu.Unlock()
	}
}

var (
	ErrQRSessionNotFound = &QRError{Message: "session not found"}
	ErrQRSessionExpired  = &QRError{Message: "session expired"}
	ErrQRInvalidToken    = &QRError{Message: "invalid token"}
	ErrQRSessionUsed     = &QRError{Message: "session already used"}
)

type QRError struct {
	Message string
}

func (e *QRError) Error() string {
	return e.Message
}
