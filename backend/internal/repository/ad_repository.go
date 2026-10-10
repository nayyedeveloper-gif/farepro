package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AdRepository struct {
	db *Database
}

func NewAdRepository(db *Database) *AdRepository {
	return &AdRepository{db: db}
}

// GetActiveAds returns all currently active ads
func (r *AdRepository) GetActiveAds() ([]map[string]interface{}, error) {
	query := `
		SELECT id, title, description, type, content_url, target_url, duration, 
		       is_active, start_date, end_date, impressions, clicks, created_at, updated_at
		FROM ads
		WHERE is_active = true
		  AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
		  AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active ads: %w", err)
	}
	defer rows.Close()

	var ads []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var title, description, adType, contentURL, targetURL string
		var duration int
		var isActive bool
		var startDate, endDate sql.NullTime
		var impressions, clicks int
		var createdAt, updatedAt time.Time

		err := rows.Scan(&id, &title, &description, &adType, &contentURL, &targetURL, &duration,
			&isActive, &startDate, &endDate, &impressions, &clicks, &createdAt, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan ad: %w", err)
		}

		ad := map[string]interface{}{
			"id":          id.String(),
			"title":       title,
			"description": description,
			"type":        adType,
			"contentUrl":  contentURL,
			"targetUrl":   targetURL,
			"duration":    duration,
			"isActive":    isActive,
			"startDate":   formatTime(startDate),
			"endDate":     formatTime(endDate),
			"impressions": impressions,
			"clicks":      clicks,
			"createdAt":   createdAt.Format("2006-01-02 15:04"),
			"updatedAt":   updatedAt.Format("2006-01-02 15:04"),
		}
		ads = append(ads, ad)
	}

	return ads, nil
}

// GetAllAds returns all ads with pagination
func (r *AdRepository) GetAllAds(page, limit int) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	err := r.db.Get(&total, "SELECT COUNT(*) FROM ads")
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get ads count: %w", err)
	}

	// Get ads with pagination
	query := `
		SELECT id, title, description, type, content_url, target_url, duration, 
		       is_active, start_date, end_date, impressions, clicks, created_at, updated_at
		FROM ads
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get ads: %w", err)
	}
	defer rows.Close()

	var ads []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var title, description, adType, contentURL, targetURL string
		var duration int
		var isActive bool
		var startDate, endDate sql.NullTime
		var impressions, clicks int
		var createdAt, updatedAt time.Time

		err := rows.Scan(&id, &title, &description, &adType, &contentURL, &targetURL, &duration,
			&isActive, &startDate, &endDate, &impressions, &clicks, &createdAt, &updatedAt)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan ad: %w", err)
		}

		ad := map[string]interface{}{
			"id":          id.String(),
			"title":       title,
			"description": description,
			"type":        adType,
			"contentUrl":  contentURL,
			"targetUrl":   targetURL,
			"duration":    duration,
			"isActive":    isActive,
			"startDate":   formatTime(startDate),
			"endDate":     formatTime(endDate),
			"impressions": impressions,
			"clicks":      clicks,
			"createdAt":   createdAt.Format("2006-01-02 15:04"),
			"updatedAt":   updatedAt.Format("2006-01-02 15:04"),
		}
		ads = append(ads, ad)
	}

	return ads, total, nil
}

// CreateAd creates a new ad
func (r *AdRepository) CreateAd(ad map[string]interface{}) (uuid.UUID, error) {
	id := uuid.New()
	query := `
		INSERT INTO ads (id, title, description, type, content_url, target_url, duration, 
		                is_active, start_date, end_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`

	var startDate, endDate sql.NullTime
	if ad["startDate"] != nil && ad["startDate"] != "" {
		if t, err := time.Parse("2006-01-02", ad["startDate"].(string)); err == nil {
			startDate = sql.NullTime{Time: t, Valid: true}
		}
	}
	if ad["endDate"] != nil && ad["endDate"] != "" {
		if t, err := time.Parse("2006-01-02", ad["endDate"].(string)); err == nil {
			endDate = sql.NullTime{Time: t, Valid: true}
		}
	}

	err := r.db.QueryRow(query,
		id,
		ad["title"],
		ad["description"],
		ad["type"],
		ad["contentUrl"],
		ad["targetUrl"],
		ad["duration"],
		ad["isActive"],
		startDate,
		endDate,
	).Scan(&id)

	return id, err
}

// UpdateAd updates an existing ad
func (r *AdRepository) UpdateAd(id uuid.UUID, ad map[string]interface{}) error {
	query := `
		UPDATE ads
		SET title = COALESCE($1, title),
		    description = COALESCE($2, description),
		    type = COALESCE($3, type),
		    content_url = COALESCE($4, content_url),
		    target_url = COALESCE($5, target_url),
		    duration = COALESCE($6, duration),
		    is_active = COALESCE($7, is_active),
		    start_date = COALESCE($8, start_date),
		    end_date = COALESCE($9, end_date),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $10
	`

	var startDate, endDate sql.NullTime
	if ad["startDate"] != nil && ad["startDate"] != "" {
		if t, err := time.Parse("2006-01-02", ad["startDate"].(string)); err == nil {
			startDate = sql.NullTime{Time: t, Valid: true}
		}
	}
	if ad["endDate"] != nil && ad["endDate"] != "" {
		if t, err := time.Parse("2006-01-02", ad["endDate"].(string)); err == nil {
			endDate = sql.NullTime{Time: t, Valid: true}
		}
	}

	_, err := r.db.Exec(query,
		ad["title"],
		ad["description"],
		ad["type"],
		ad["contentUrl"],
		ad["targetUrl"],
		ad["duration"],
		ad["isActive"],
		startDate,
		endDate,
		id,
	)

	return err
}

// DeleteAd deletes an ad
func (r *AdRepository) DeleteAd(id uuid.UUID) error {
	query := `DELETE FROM ads WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// TrackImpression increments ad impression count
func (r *AdRepository) TrackImpression(id uuid.UUID) error {
	query := `UPDATE ads SET impressions = impressions + 1 WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// TrackClick increments ad click count
func (r *AdRepository) TrackClick(id uuid.UUID) error {
	query := `UPDATE ads SET clicks = clicks + 1 WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// GetAdAnalytics returns analytics for all ads
func (r *AdRepository) GetAdAnalytics() ([]map[string]interface{}, error) {
	query := `
		SELECT id, title, impressions, clicks,
		       CASE WHEN impressions > 0 THEN ROUND((clicks::float / impressions::float) * 100, 2) ELSE 0 END as ctr
		FROM ads
		ORDER BY impressions DESC
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get ad analytics: %w", err)
	}
	defer rows.Close()

	var analytics []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var title string
		var impressions, clicks int
		var ctr float64

		err := rows.Scan(&id, &title, &impressions, &clicks, &ctr)
		if err != nil {
			return nil, fmt.Errorf("failed to scan analytics: %w", err)
		}

		analytics = append(analytics, map[string]interface{}{
			"adId":        id.String(),
			"title":       title,
			"impressions": impressions,
			"clicks":      clicks,
			"ctr":         ctr,
		})
	}

	return analytics, nil
}
