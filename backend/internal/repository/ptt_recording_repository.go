package repository

import (
	"fmt"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type PTTRecordingRepository struct {
	db *sqlx.DB
}

func NewPTTRecordingRepository(db *sqlx.DB) *PTTRecordingRepository {
	return &PTTRecordingRepository{db: db}
}

func (r *PTTRecordingRepository) Migrate() error {
	query := `
		CREATE TABLE IF NOT EXISTS ptt_recordings (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			file_url TEXT NOT NULL,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_ptt_recordings_channel ON ptt_recordings(channel_id, created_at DESC);
	`
	_, err := r.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to migrate ptt_recordings: %w", err)
	}
	_, _ = r.db.Exec(`ALTER TABLE ptt_recordings ADD COLUMN IF NOT EXISTS transcription_text TEXT`)
	_, _ = r.db.Exec(`ALTER TABLE ptt_recordings ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(20) DEFAULT 'none'`)
	return nil
}

func (r *PTTRecordingRepository) Create(rec *models.PTTRecording) error {
	query := `
		INSERT INTO ptt_recordings (id, channel_id, user_id, file_url, duration_ms)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`
	return r.db.QueryRow(query, rec.ID, rec.ChannelID, rec.UserID, rec.FileURL, rec.DurationMs).
		Scan(&rec.CreatedAt)
}

func (r *PTTRecordingRepository) ListByChannel(channelID uuid.UUID, limit int) ([]models.PTTRecording, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query := `
		SELECT r.id, r.channel_id, r.user_id, r.file_url, r.duration_ms,
			COALESCE(r.transcription_text, '') as transcription_text,
			COALESCE(r.transcription_status, 'none') as transcription_status,
			r.created_at,
			u.id as "user.id", u.username as "user.username", u.first_name as "user.first_name",
			u.last_name as "user.last_name", u.avatar_url as "user.avatar_url"
		FROM ptt_recordings r
		JOIN users u ON r.user_id = u.id
		WHERE r.channel_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2
	`
	var recordings []models.PTTRecording
	if err := r.db.Select(&recordings, query, channelID, limit); err != nil {
		return nil, err
	}
	if recordings == nil {
		recordings = []models.PTTRecording{}
	}
	return recordings, nil
}

func (r *PTTRecordingRepository) GetByID(recordingID uuid.UUID) (*models.PTTRecording, error) {
	query := `
		SELECT id, channel_id, user_id, file_url, duration_ms,
			COALESCE(transcription_text, '') as transcription_text,
			COALESCE(transcription_status, 'none') as transcription_status,
			created_at
		FROM ptt_recordings WHERE id = $1
	`
	var rec models.PTTRecording
	if err := r.db.Get(&rec, query, recordingID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *PTTRecordingRepository) UpdateTranscription(id uuid.UUID, text, status string) error {
	_, err := r.db.Exec(
		`UPDATE ptt_recordings SET transcription_text = $2, transcription_status = $3 WHERE id = $1`,
		id, text, status,
	)
	return err
}
