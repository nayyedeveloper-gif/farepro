package repository

import (
	"errors"
	"telegram-clone/internal/models"
	"time"

	"github.com/google/uuid"
)

var errNotFound = errors.New("not found")

type StoryRepository struct {
	db *Database
}

func NewStoryRepository(db *Database) *StoryRepository {
	return &StoryRepository{db: db}
}

// Migrate creates the stories and story_views tables if they don't exist
func (r *StoryRepository) Migrate() error {
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS stories (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			type        VARCHAR(10) NOT NULL DEFAULT 'text',
			content     TEXT,
			media_url   TEXT,
			duration    INT DEFAULT 0,
			caption     TEXT,
			view_count  INT DEFAULT 0,
			expires_at  TIMESTAMPTZ NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS story_views (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
			viewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(story_id, viewer_id)
		);

		CREATE INDEX IF NOT EXISTS idx_stories_user_id    ON stories(user_id);
		CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
		CREATE INDEX IF NOT EXISTS idx_story_views_story  ON story_views(story_id);
	`)
	return err
}

// CreateStory inserts a new story
func (r *StoryRepository) CreateStory(story *models.Story) error {
	return r.db.QueryRowx(`
		INSERT INTO stories (id, user_id, type, content, media_url, duration, caption, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`, story.ID, story.UserID, story.Type, story.Content, story.MediaURL,
		story.Duration, story.Caption, story.ExpiresAt, story.CreatedAt).
		Scan(&story.ID, &story.CreatedAt)
}

// GetActiveStoriesByUser returns non-expired stories for a specific user
func (r *StoryRepository) GetActiveStoriesByUser(userID, viewerID uuid.UUID) ([]*models.Story, error) {
	rows, err := r.db.Query(`
		SELECT s.id, s.user_id, s.type, COALESCE(s.content,''), COALESCE(s.media_url,''),
		       s.duration, COALESCE(s.caption,''), s.view_count, s.expires_at, s.created_at,
		       u.id, u.username, COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar_url,''),
		       (sv.viewer_id IS NOT NULL) AS is_viewed
		FROM stories s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $2
		WHERE s.user_id = $1 AND s.expires_at > NOW()
		ORDER BY s.created_at DESC
	`, userID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStoryRows(rows)
}

// GetAllActiveStories returns active stories from all users grouped by user
func (r *StoryRepository) GetAllActiveStories(viewerID uuid.UUID) ([]*models.Story, error) {
	rows, err := r.db.Query(`
		SELECT s.id, s.user_id, s.type, COALESCE(s.content,''), COALESCE(s.media_url,''),
		       s.duration, COALESCE(s.caption,''), s.view_count, s.expires_at, s.created_at,
		       u.id, u.username, COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar_url,''),
		       (sv.viewer_id IS NOT NULL) AS is_viewed
		FROM stories s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $1
		WHERE s.expires_at > NOW()
		ORDER BY s.user_id, s.created_at ASC
	`, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStoryRows(rows)
}

// GetStoryByID fetches a single story with viewer info
func (r *StoryRepository) GetStoryByID(storyID, viewerID uuid.UUID) (*models.Story, error) {
	var story models.Story
	var user models.User
	err := r.db.QueryRow(`
		SELECT s.id, s.user_id, s.type, COALESCE(s.content,''), COALESCE(s.media_url,''),
		       s.duration, COALESCE(s.caption,''), s.view_count, s.expires_at, s.created_at,
		       u.id, u.username, COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar_url,''),
		       (sv.viewer_id IS NOT NULL) AS is_viewed
		FROM stories s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = $2
		WHERE s.id = $1
	`, storyID, viewerID).Scan(
		&story.ID, &story.UserID, &story.Type, &story.Content, &story.MediaURL,
		&story.Duration, &story.Caption, &story.ViewCount, &story.ExpiresAt, &story.CreatedAt,
		&user.ID, &user.Username, &user.FirstName, &user.LastName, &user.AvatarURL,
		&story.IsViewed,
	)
	if err != nil {
		return nil, err
	}
	story.User = &user
	return &story, nil
}

// RecordView marks a story as viewed and increments view count (once per viewer)
func (r *StoryRepository) RecordView(storyID, viewerID uuid.UUID) error {
	var inserted bool
	err := r.db.QueryRow(`
		WITH ins AS (
			INSERT INTO story_views (id, story_id, viewer_id)
			VALUES (gen_random_uuid(), $1, $2)
			ON CONFLICT (story_id, viewer_id) DO NOTHING
			RETURNING 1
		)
		SELECT COUNT(*) > 0 FROM ins
	`, storyID, viewerID).Scan(&inserted)
	if err != nil {
		return err
	}
	if inserted {
		_, err = r.db.Exec(`UPDATE stories SET view_count = view_count + 1 WHERE id = $1`, storyID)
	}
	return err
}

// DeleteStory removes a story (only by owner)
func (r *StoryRepository) DeleteStory(storyID, ownerID uuid.UUID) error {
	result, err := r.db.Exec(`
		DELETE FROM stories WHERE id = $1 AND user_id = $2
	`, storyID, ownerID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return errNotFound
	}
	return nil
}

// GetUserStoryStats returns post/media/voice counts for profile tabs
func (r *StoryRepository) GetUserStoryStats(userID uuid.UUID) (map[string]int, error) {
	rows, err := r.db.Queryx(`
		SELECT type, COUNT(*) AS cnt
		FROM stories
		WHERE user_id = $1 AND expires_at > NOW()
		GROUP BY type
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := map[string]int{"text": 0, "image": 0, "video": 0, "voice": 0}
	for rows.Next() {
		var t string
		var cnt int
		if err := rows.Scan(&t, &cnt); err != nil {
			return nil, err
		}
		stats[t] = cnt
	}
	return stats, nil
}

// DeleteExpiredStories cleans up old stories
func (r *StoryRepository) DeleteExpiredStories() error {
	_, err := r.db.Exec(`DELETE FROM stories WHERE expires_at < $1`, time.Now())
	return err
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func scanStoryRows(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
	Err() error
}) ([]*models.Story, error) {
	var stories []*models.Story
	for rows.Next() {
		var s models.Story
		var u models.User
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.Type, &s.Content, &s.MediaURL,
			&s.Duration, &s.Caption, &s.ViewCount, &s.ExpiresAt, &s.CreatedAt,
			&u.ID, &u.Username, &u.FirstName, &u.LastName, &u.AvatarURL,
			&s.IsViewed,
		); err != nil {
			return nil, err
		}
		s.User = &u
		stories = append(stories, &s)
	}
	return stories, rows.Err()
}
