package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Migrate adds the account-suspension columns and the platform audit log.
// Statements are additive and idempotent so they are safe on every startup.
func (r *PlatformRepository) Migrate() error {
	_, err := r.db.Exec(`
	ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
	ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT NOT NULL DEFAULT '';
	ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

	CREATE TABLE IF NOT EXISTS platform_audit_log (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
		action VARCHAR(64) NOT NULL,
		target_type VARCHAR(32) NOT NULL DEFAULT '',
		target_id TEXT NOT NULL DEFAULT '',
		summary TEXT NOT NULL DEFAULT '',
		metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
		ip TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log (created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_platform_audit_target ON platform_audit_log (target_type, target_id);
	CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON platform_audit_log (actor_id);
	`)
	return err
}

type PlatformUserRow struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	Username        string     `json:"username" db:"username"`
	Phone           string     `json:"phone" db:"phone"`
	FirstName       string     `json:"firstName" db:"first_name"`
	LastName        string     `json:"lastName" db:"last_name"`
	IsOnline        bool       `json:"isOnline" db:"is_online"`
	IsPlatformAdmin bool       `json:"isPlatformAdmin" db:"is_platform_admin"`
	IsBanned        bool       `json:"isBanned" db:"is_banned"`
	BannedReason    string     `json:"bannedReason" db:"banned_reason"`
	BannedAt        *time.Time `json:"bannedAt,omitempty" db:"banned_at"`
	LastSeen        *time.Time `json:"lastSeen,omitempty" db:"last_seen"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	Stands          string     `json:"stands" db:"stands"`
}

type PlatformUserFilter struct {
	Query  string
	Status string // all | banned | admins | staff | personal
	Limit  int
	Offset int
}

func (r *PlatformRepository) ListUsers(f PlatformUserFilter) ([]PlatformUserRow, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		where = append(where, `(LOWER(u.username) LIKE $1 OR COALESCE(u.phone,'') LIKE $1
			OR LOWER(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) LIKE $1)`)
	}
	switch f.Status {
	case "banned":
		where = append(where, "u.is_banned = true")
	case "admins":
		where = append(where, "u.is_platform_admin = true")
	case "staff":
		where = append(where, "EXISTS (SELECT 1 FROM user_organizations x WHERE x.user_id = u.id)")
	case "personal":
		where = append(where, "NOT EXISTS (SELECT 1 FROM user_organizations x WHERE x.user_id = u.id)")
	}
	cond := strings.Join(where, " AND ")

	var total int
	if err := r.db.Get(&total, `SELECT COUNT(*) FROM users u WHERE `+cond, args...); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	query := `
		SELECT u.id, u.username, COALESCE(u.phone,'') AS phone,
			COALESCE(u.first_name,'') AS first_name, COALESCE(u.last_name,'') AS last_name,
			COALESCE(u.is_online,false) AS is_online, COALESCE(u.is_platform_admin,false) AS is_platform_admin,
			u.is_banned, u.banned_reason, u.banned_at, u.last_seen, u.created_at,
			COALESCE((
				SELECT string_agg(o.name || ' (' || uo.role || ')', ', ' ORDER BY o.name)
				FROM user_organizations uo JOIN organizations o ON o.id = uo.organization_id
				WHERE uo.user_id = u.id
			), '') AS stands
		FROM users u
		WHERE ` + cond + `
		ORDER BY u.created_at DESC
		LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))
	var rows []PlatformUserRow
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, 0, err
	}
	if rows == nil {
		rows = []PlatformUserRow{}
	}
	return rows, total, nil
}

type PlatformUserBrief struct {
	ID              uuid.UUID `db:"id"`
	Username        string    `db:"username"`
	Phone           string    `db:"phone"`
	IsPlatformAdmin bool      `db:"is_platform_admin"`
	IsBanned        bool      `db:"is_banned"`
}

var ErrUserNotFound = errors.New("user not found")

func (r *PlatformRepository) GetUserBrief(id uuid.UUID) (*PlatformUserBrief, error) {
	var u PlatformUserBrief
	err := r.db.Get(&u, `SELECT id, username, COALESCE(phone,'') AS phone,
		COALESCE(is_platform_admin,false) AS is_platform_admin, is_banned FROM users WHERE id = $1`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *PlatformRepository) SetUserBan(id uuid.UUID, banned bool, reason string) error {
	var err error
	if banned {
		_, err = r.db.Exec(`UPDATE users SET is_banned = true, banned_reason = $2, banned_at = NOW(),
			is_online = false, updated_at = NOW() WHERE id = $1`, id, reason)
	} else {
		_, err = r.db.Exec(`UPDATE users SET is_banned = false, banned_reason = '', banned_at = NULL,
			updated_at = NOW() WHERE id = $1`, id)
	}
	return err
}

type AuditEntry struct {
	ActorID    uuid.UUID
	Action     string
	TargetType string
	TargetID   string
	Summary    string
	Metadata   map[string]interface{}
	IP         string
}

func (r *PlatformRepository) InsertAudit(e AuditEntry) error {
	meta := []byte("{}")
	if len(e.Metadata) > 0 {
		if b, err := json.Marshal(e.Metadata); err == nil {
			meta = b
		}
	}
	_, err := r.db.Exec(`INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, summary, metadata, ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		e.ActorID, e.Action, e.TargetType, e.TargetID, e.Summary, meta, e.IP)
	return err
}

type PlatformAuditRow struct {
	ID         uuid.UUID       `json:"id" db:"id"`
	ActorID    *uuid.UUID      `json:"actorId,omitempty" db:"actor_id"`
	ActorName  string          `json:"actorName" db:"actor_name"`
	ActorPhone string          `json:"actorPhone" db:"actor_phone"`
	Action     string          `json:"action" db:"action"`
	TargetType string          `json:"targetType" db:"target_type"`
	TargetID   string          `json:"targetId" db:"target_id"`
	Summary    string          `json:"summary" db:"summary"`
	Metadata   json.RawMessage `json:"metadata" db:"metadata"`
	IP         string          `json:"ip" db:"ip"`
	CreatedAt  time.Time       `json:"createdAt" db:"created_at"`
}

type PlatformAuditFilter struct {
	Action     string
	TargetType string
	TargetID   string
	Query      string
	Limit      int
}

func (r *PlatformRepository) ListAudit(f PlatformAuditFilter) ([]PlatformAuditRow, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	add := func(cond string, v interface{}) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(args))))
	}
	if f.Action != "" {
		add("a.action = ?", f.Action)
	}
	if f.TargetType != "" {
		add("a.target_type = ?", f.TargetType)
	}
	if f.TargetID != "" {
		add("a.target_id = ?", f.TargetID)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		add("(LOWER(a.summary) LIKE ? OR LOWER(COALESCE(u.username,'')) LIKE ?)", "%"+strings.ToLower(q)+"%")
	}
	limit := f.Limit
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	args = append(args, limit)
	query := `
		SELECT a.id, a.actor_id,
			COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.username, 'Deleted user') AS actor_name,
			COALESCE(u.phone,'') AS actor_phone,
			a.action, a.target_type, a.target_id, a.summary, a.metadata, a.ip, a.created_at
		FROM platform_audit_log a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY a.created_at DESC
		LIMIT $` + strconv.Itoa(len(args))
	var rows []PlatformAuditRow
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PlatformAuditRow{}
	}
	return rows, nil
}

// PingDB measures a round trip to Postgres.
func (r *PlatformRepository) PingDB(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	err := r.db.PingContext(ctx)
	return time.Since(start), err
}

type PlatformDBStats struct {
	Users       int    `json:"users" db:"users"`
	BannedUsers int    `json:"bannedUsers" db:"banned_users"`
	Stands      int    `json:"stands" db:"stands"`
	Trips       int    `json:"trips" db:"trips"`
	DBSize      string `json:"dbSize" db:"db_size"`
}

func (r *PlatformRepository) DBStats() (*PlatformDBStats, error) {
	var s PlatformDBStats
	err := r.db.Get(&s, `
		SELECT
			(SELECT COUNT(*) FROM users) AS users,
			(SELECT COUNT(*) FROM users WHERE is_banned) AS banned_users,
			(SELECT COUNT(*) FROM organizations) AS stands,
			(SELECT COUNT(*) FROM trips) AS trips,
			pg_size_pretty(pg_database_size(current_database())) AS db_size`)
	return &s, err
}
