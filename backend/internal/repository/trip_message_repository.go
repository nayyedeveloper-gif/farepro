package repository

import (
	"fmt"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type TripMessageRepository struct {
	db *sqlx.DB
}

func NewTripMessageRepository(db *sqlx.DB) *TripMessageRepository {
	return &TripMessageRepository{db: db}
}

func (r *TripMessageRepository) Migrate() error {
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS trip_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
			sender_role VARCHAR(20) NOT NULL,
			sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
			body TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_trip_messages_trip ON trip_messages(trip_id, created_at);
	`)
	return err
}

func (r *TripMessageRepository) ListByTrip(tripID uuid.UUID, limit int) ([]models.TripMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	query := `
		SELECT id, trip_id, sender_role, sender_user_id, body, created_at
		FROM trip_messages WHERE trip_id = $1
		ORDER BY created_at ASC LIMIT ` + fmt.Sprintf("%d", limit)
	var msgs []models.TripMessage
	if err := r.db.Select(&msgs, query, tripID); err != nil {
		return nil, err
	}
	if msgs == nil {
		msgs = []models.TripMessage{}
	}
	return msgs, nil
}

func (r *TripMessageRepository) Create(msg *models.TripMessage) error {
	query := `
		INSERT INTO trip_messages (id, trip_id, sender_role, sender_user_id, body)
		VALUES ($1, $2, $3, $4, $5) RETURNING created_at
	`
	return r.db.QueryRowx(query, msg.ID, msg.TripID, msg.SenderRole, msg.SenderUserID, msg.Body).Scan(&msg.CreatedAt)
}
