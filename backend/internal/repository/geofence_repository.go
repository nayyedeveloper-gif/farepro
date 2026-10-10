package repository

import (
	"database/sql"
	"fmt"
	"math"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type GeofenceRepository struct {
	db *sqlx.DB
}

func NewGeofenceRepository(db *sqlx.DB) *GeofenceRepository {
	return &GeofenceRepository{db: db}
}

func (r *GeofenceRepository) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS geofence_zones (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			channel_id UUID REFERENCES ptt_channels(id) ON DELETE SET NULL,
			name VARCHAR(100) NOT NULL,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			radius_meters DOUBLE PRECISION NOT NULL,
			alert_on VARCHAR(10) NOT NULL DEFAULT 'both',
			color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS geofence_zone_states (
			zone_id UUID NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			inside BOOLEAN NOT NULL DEFAULT false,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (zone_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS geofence_alerts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			zone_id UUID NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			event_type VARCHAR(10) NOT NULL,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, q := range queries {
		if _, err := r.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

func distanceMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

func (r *GeofenceRepository) ListZones(orgID uuid.UUID) ([]models.GeofenceZone, error) {
	query := `
		SELECT id, org_id, channel_id, name, latitude, longitude, radius_meters,
			alert_on, color, is_active, created_at
		FROM geofence_zones
		WHERE org_id = $1
		ORDER BY created_at DESC
	`
	var zones []models.GeofenceZone
	if err := r.db.Select(&zones, query, orgID); err != nil {
		return nil, fmt.Errorf("failed to list geofence zones: %w", err)
	}
	if zones == nil {
		zones = []models.GeofenceZone{}
	}
	return zones, nil
}

func (r *GeofenceRepository) GetZone(orgID, zoneID uuid.UUID) (*models.GeofenceZone, error) {
	query := `
		SELECT id, org_id, channel_id, name, latitude, longitude, radius_meters,
			alert_on, color, is_active, created_at
		FROM geofence_zones
		WHERE id = $1 AND org_id = $2
	`
	var zone models.GeofenceZone
	if err := r.db.Get(&zone, query, zoneID, orgID); err != nil {
		return nil, err
	}
	return &zone, nil
}

func (r *GeofenceRepository) CreateZone(zone *models.GeofenceZone) error {
	query := `
		INSERT INTO geofence_zones (id, org_id, channel_id, name, latitude, longitude,
			radius_meters, alert_on, color, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at
	`
	return r.db.QueryRowx(query,
		zone.ID, zone.OrgID, zone.ChannelID, zone.Name, zone.Latitude, zone.Longitude,
		zone.RadiusMeters, zone.AlertOn, zone.Color, zone.IsActive,
	).Scan(&zone.CreatedAt)
}

func (r *GeofenceRepository) UpdateZone(zone *models.GeofenceZone) error {
	query := `
		UPDATE geofence_zones
		SET name = $1, latitude = $2, longitude = $3, radius_meters = $4,
			alert_on = $5, color = $6, is_active = $7
		WHERE id = $8 AND org_id = $9
	`
	_, err := r.db.Exec(query,
		zone.Name, zone.Latitude, zone.Longitude, zone.RadiusMeters,
		zone.AlertOn, zone.Color, zone.IsActive, zone.ID, zone.OrgID,
	)
	return err
}

func (r *GeofenceRepository) DeleteZone(orgID, zoneID uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM geofence_zones WHERE id = $1 AND org_id = $2`, zoneID, orgID)
	return err
}

func (r *GeofenceRepository) ListAlerts(orgID uuid.UUID, limit int) ([]models.GeofenceAlert, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := `
		SELECT a.id, a.zone_id, a.org_id, a.channel_id, a.user_id, a.event_type,
			a.latitude, a.longitude, a.created_at,
			z.id as "zone.id", z.name as "zone.name", z.color as "zone.color",
			u.id as "user.id", u.username as "user.username",
			u.first_name as "user.first_name", u.last_name as "user.last_name",
			u.avatar_url as "user.avatar_url"
		FROM geofence_alerts a
		JOIN geofence_zones z ON a.zone_id = z.id
		JOIN users u ON a.user_id = u.id
		WHERE a.org_id = $1
		ORDER BY a.created_at DESC
		LIMIT $2
	`
	var alerts []models.GeofenceAlert
	if err := r.db.Select(&alerts, query, orgID, limit); err != nil {
		return nil, fmt.Errorf("failed to list geofence alerts: %w", err)
	}
	if alerts == nil {
		alerts = []models.GeofenceAlert{}
	}
	return alerts, nil
}

func (r *GeofenceRepository) getZoneState(zoneID, userID uuid.UUID) (bool, bool, error) {
	var inside bool
	err := r.db.Get(&inside, `
		SELECT inside FROM geofence_zone_states WHERE zone_id = $1 AND user_id = $2
	`, zoneID, userID)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return inside, true, nil
}

func (r *GeofenceRepository) setZoneState(zoneID, userID uuid.UUID, inside bool) error {
	query := `
		INSERT INTO geofence_zone_states (zone_id, user_id, inside, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (zone_id, user_id) DO UPDATE
		SET inside = $3, updated_at = NOW()
	`
	_, err := r.db.Exec(query, zoneID, userID, inside)
	return err
}

func (r *GeofenceRepository) createAlert(alert *models.GeofenceAlert) error {
	query := `
		INSERT INTO geofence_alerts (id, zone_id, org_id, channel_id, user_id,
			event_type, latitude, longitude)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at
	`
	return r.db.QueryRowx(query,
		alert.ID, alert.ZoneID, alert.OrgID, alert.ChannelID, alert.UserID,
		alert.EventType, alert.Latitude, alert.Longitude,
	).Scan(&alert.CreatedAt)
}

func (r *GeofenceRepository) ListActiveZonesForLocation(orgID, channelID uuid.UUID) ([]models.GeofenceZone, error) {
	query := `
		SELECT id, org_id, channel_id, name, latitude, longitude, radius_meters,
			alert_on, color, is_active, created_at
		FROM geofence_zones
		WHERE org_id = $1 AND is_active = true
			AND (channel_id IS NULL OR channel_id = $2)
	`
	var zones []models.GeofenceZone
	if err := r.db.Select(&zones, query, orgID, channelID); err != nil {
		return nil, err
	}
	return zones, nil
}

func (r *GeofenceRepository) ProcessLocationUpdate(
	orgID, channelID, userID uuid.UUID,
	latitude, longitude float64,
) ([]models.GeofenceAlert, error) {
	zones, err := r.ListActiveZonesForLocation(orgID, channelID)
	if err != nil {
		return nil, err
	}
	if len(zones) == 0 {
		return nil, nil
	}

	var alerts []models.GeofenceAlert
	for _, zone := range zones {
		inside := distanceMeters(latitude, longitude, zone.Latitude, zone.Longitude) <= zone.RadiusMeters
		wasInside, hasState, err := r.getZoneState(zone.ID, userID)
		if err != nil {
			continue
		}

		if !hasState {
			_ = r.setZoneState(zone.ID, userID, inside)
			continue
		}

		if inside == wasInside {
			continue
		}

		eventType := ""
		if inside && (zone.AlertOn == "enter" || zone.AlertOn == "both") {
			eventType = "enter"
		} else if !inside && (zone.AlertOn == "exit" || zone.AlertOn == "both") {
			eventType = "exit"
		}

		_ = r.setZoneState(zone.ID, userID, inside)
		if eventType == "" {
			continue
		}

		alert := models.GeofenceAlert{
			ID:        uuid.New(),
			ZoneID:    zone.ID,
			OrgID:     orgID,
			ChannelID: channelID,
			UserID:    userID,
			EventType: eventType,
			Latitude:  latitude,
			Longitude: longitude,
		}
		zoneCopy := zone
		alert.Zone = &zoneCopy
		if err := r.createAlert(&alert); err != nil {
			continue
		}
		alerts = append(alerts, alert)
	}
	return alerts, nil
}
