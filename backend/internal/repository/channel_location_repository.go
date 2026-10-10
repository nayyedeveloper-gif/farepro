package repository

import (
	"fmt"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ChannelLocationRepository struct {
	db *sqlx.DB
}

func NewChannelLocationRepository(db *sqlx.DB) *ChannelLocationRepository {
	return &ChannelLocationRepository{db: db}
}

func (r *ChannelLocationRepository) UpsertLocation(loc *models.ChannelLocation) error {
	query := `
		INSERT INTO ptt_channel_locations (id, channel_id, user_id, latitude, longitude, heading, speed, status, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (channel_id, user_id) DO UPDATE
		SET latitude = $4, longitude = $5, heading = $6, speed = $7, status = $8, updated_at = NOW()
		RETURNING id, updated_at
	`
	if err := r.db.QueryRowx(query,
		loc.ID, loc.ChannelID, loc.UserID, loc.Latitude, loc.Longitude,
		loc.Heading, loc.Speed, loc.Status,
	).Scan(&loc.ID, &loc.UpdatedAt); err != nil {
		return err
	}

	trailQuery := `
		INSERT INTO ptt_location_trail (channel_id, user_id, latitude, longitude, heading, speed)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, _ = r.db.Exec(trailQuery, loc.ChannelID, loc.UserID, loc.Latitude, loc.Longitude, loc.Heading, loc.Speed)
	return nil
}

func (r *ChannelLocationRepository) GetChannelLocations(channelID uuid.UUID) ([]models.ChannelLocation, error) {
	query := `
		SELECT l.id, l.channel_id, l.user_id, l.latitude, l.longitude, l.heading, l.speed, l.status, l.updated_at,
			u.id as "user.id", u.username as "user.username", u.first_name as "user.first_name",
			u.last_name as "user.last_name", u.avatar_url as "user.avatar_url"
		FROM ptt_channel_locations l
		JOIN users u ON l.user_id = u.id
		WHERE l.channel_id = $1 AND l.status != 'off'
		ORDER BY l.updated_at DESC
	`
	var locations []models.ChannelLocation
	if err := r.db.Select(&locations, query, channelID); err != nil {
		return nil, fmt.Errorf("failed to get channel locations: %w", err)
	}
	if locations == nil {
		locations = []models.ChannelLocation{}
	}
	return locations, nil
}

func (r *ChannelLocationRepository) GetLatestLocationsForUsers(userIDs []uuid.UUID) ([]models.ChannelLocation, error) {
	if len(userIDs) == 0 {
		return []models.ChannelLocation{}, nil
	}
	query, args, err := sqlx.In(`
		SELECT DISTINCT ON (l.user_id)
			l.id, l.channel_id, l.user_id, l.latitude, l.longitude, l.heading, l.speed, l.status, l.updated_at,
			u.id as "user.id", u.username as "user.username", u.first_name as "user.first_name",
			u.last_name as "user.last_name", u.avatar_url as "user.avatar_url"
		FROM ptt_channel_locations l
		JOIN users u ON l.user_id = u.id
		WHERE l.user_id IN (?)
		ORDER BY l.user_id, l.updated_at DESC
	`, userIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to build location query: %w", err)
	}
	query = r.db.Rebind(query)

	var locations []models.ChannelLocation
	if err := r.db.Select(&locations, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get user locations: %w", err)
	}
	if locations == nil {
		locations = []models.ChannelLocation{}
	}
	return locations, nil
}

func (r *ChannelLocationRepository) DeleteLocation(channelID, userID uuid.UUID) error {
	query := `DELETE FROM ptt_channel_locations WHERE channel_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}

func (r *ChannelLocationRepository) Migrate() error {
	query := `
		CREATE TABLE IF NOT EXISTS ptt_channel_locations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			heading DOUBLE PRECISION DEFAULT 0,
			speed DOUBLE PRECISION DEFAULT 0,
			status VARCHAR(20) NOT NULL DEFAULT 'available',
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(channel_id, user_id)
		)
	`
	if _, err := r.db.Exec(query); err != nil {
		return err
	}

	trailQuery := `
		CREATE TABLE IF NOT EXISTS ptt_location_trail (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			heading DOUBLE PRECISION DEFAULT 0,
			speed DOUBLE PRECISION DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`
	_, err := r.db.Exec(trailQuery)
	return err
}

func (r *ChannelLocationRepository) GetLocationTrail(channelID, userID uuid.UUID, limit int) ([]models.LocationTrailPoint, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	query := `
		SELECT id, channel_id, user_id, latitude, longitude, heading, speed, created_at
		FROM ptt_location_trail
		WHERE channel_id = $1 AND user_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`
	var points []models.LocationTrailPoint
	if err := r.db.Select(&points, query, channelID, userID, limit); err != nil {
		return nil, fmt.Errorf("failed to get location trail: %w", err)
	}
	if points == nil {
		points = []models.LocationTrailPoint{}
	}
	return points, nil
}

func (r *ChannelLocationRepository) ClearTrail(channelID, userID uuid.UUID) error {
	query := `DELETE FROM ptt_location_trail WHERE channel_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}
