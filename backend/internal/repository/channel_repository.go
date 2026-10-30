package repository

import (
	"database/sql"
	"fmt"

	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ChannelRepository struct {
	db *sqlx.DB
}

func NewChannelRepository(db *sqlx.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

func (r *ChannelRepository) CreateChannel(name, description string, createdBy uuid.UUID) (*models.Channel, error) {
	return r.CreateChannelForOrg(name, description, createdBy, nil)
}

func (r *ChannelRepository) CreateChannelForOrg(name, description string, createdBy uuid.UUID, orgID *uuid.UUID) (*models.Channel, error) {
	query := `
		INSERT INTO ptt_channels (name, description, created_by, organization_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, COALESCE(description,'') as description,
		          COALESCE(avatar_url,'') as avatar_url,
		          is_private, COALESCE(invite_token,'') as invite_token,
		          created_by, organization_id, created_at, updated_at
	`
	var ch models.Channel
	if err := r.db.QueryRowx(query, name, description, createdBy, orgID).StructScan(&ch); err != nil {
		return nil, fmt.Errorf("failed to create channel: %w", err)
	}
	return &ch, nil
}

func (r *ChannelRepository) GetChannelByID(id uuid.UUID) (*models.Channel, error) {
	var ch models.Channel
	query := `SELECT id, name, COALESCE(description,'') as description,
	           COALESCE(avatar_url,'') as avatar_url,
	           is_private, COALESCE(invite_token,'') as invite_token,
	           created_by, created_at, updated_at FROM ptt_channels WHERE id = $1`
	if err := r.db.Get(&ch, query, id); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) ListChannels() ([]models.Channel, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description,'') as description,
		       COALESCE(c.avatar_url,'') as avatar_url,
		       c.is_private, COALESCE(c.invite_token,'') as invite_token,
		       c.created_by, c.created_at, c.updated_at,
			   (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = c.id) as member_count
		FROM ptt_channels c
		ORDER BY c.name ASC
	`
	var channels []models.Channel
	if err := r.db.Select(&channels, query); err != nil {
		return nil, err
	}
	if channels == nil {
		channels = []models.Channel{}
	}
	return channels, nil
}

func (r *ChannelRepository) JoinChannel(channelID, userID uuid.UUID) error {
	query := `INSERT INTO ptt_channel_members (channel_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (channel_id, user_id) DO NOTHING`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}

func (r *ChannelRepository) JoinChannelAsAdmin(channelID, userID uuid.UUID) error {
	query := `INSERT INTO ptt_channel_members (channel_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'admin'`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}

func (r *ChannelRepository) GetMemberRole(channelID, userID uuid.UUID) (models.ChannelRole, error) {
	var role models.ChannelRole
	query := `SELECT role FROM ptt_channel_members WHERE channel_id = $1 AND user_id = $2`
	err := r.db.Get(&role, query, channelID, userID)
	return role, err
}

func (r *ChannelRepository) UpdateMemberRole(channelID, userID uuid.UUID, role models.ChannelRole) error {
	query := `UPDATE ptt_channel_members SET role = $3 WHERE channel_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, channelID, userID, role)
	return err
}

func (r *ChannelRepository) KickMember(channelID, userID uuid.UUID) error {
	query := `DELETE FROM ptt_channel_members WHERE channel_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}

func (r *ChannelRepository) CreateEmergencyAlert(channelID, userID uuid.UUID, message string) (*models.EmergencyAlert, error) {
	query := `INSERT INTO ptt_emergency_alerts (channel_id, user_id, message) VALUES ($1, $2, $3) RETURNING id, channel_id, user_id, message, created_at`
	var alert models.EmergencyAlert
	if err := r.db.QueryRowx(query, channelID, userID, message).StructScan(&alert); err != nil {
		return nil, err
	}
	return &alert, nil
}

func (r *ChannelRepository) GetEmergencyAlerts(channelID uuid.UUID, limit int) ([]models.EmergencyAlert, error) {
	query := `
		SELECT ea.id, ea.channel_id, ea.user_id, ea.message, ea.created_at,
			u.id as "user.id", u.first_name as "user.first_name", u.username as "user.username"
		FROM ptt_emergency_alerts ea
		JOIN users u ON ea.user_id = u.id
		WHERE ea.channel_id = $1
		ORDER BY ea.created_at DESC LIMIT $2
	`
	rows, err := r.db.Queryx(query, channelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var alerts []models.EmergencyAlert
	for rows.Next() {
		var a models.EmergencyAlert
		var u models.User
		if err := rows.Scan(&a.ID, &a.ChannelID, &a.UserID, &a.Message, &a.CreatedAt, &u.ID, &u.FirstName, &u.Username); err != nil {
			continue
		}
		a.User = &u
		alerts = append(alerts, a)
	}
	if alerts == nil {
		alerts = []models.EmergencyAlert{}
	}
	return alerts, nil
}

func (r *ChannelRepository) UpdateUserStatus(userID uuid.UUID, status models.UserStatus) error {
	query := `UPDATE users SET status = $2 WHERE id = $1`
	_, err := r.db.Exec(query, userID, status)
	return err
}

func (r *ChannelRepository) LeaveChannel(channelID, userID uuid.UUID) error {
	query := `DELETE FROM ptt_channel_members WHERE channel_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, channelID, userID)
	return err
}

func (r *ChannelRepository) GetChannelMembers(channelID uuid.UUID) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email, u.phone, u.first_name, u.last_name, u.avatar_url, u.bio, u.is_online, u.last_seen, u.created_at, u.updated_at
		FROM ptt_channel_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.channel_id = $1
	`
	var users []models.User
	if err := r.db.Select(&users, query, channelID); err != nil {
		return nil, err
	}
	return users, nil
}

func (r *ChannelRepository) GetUserChannels(userID uuid.UUID) ([]models.Channel, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description,'') as description,
		       COALESCE(c.avatar_url,'') as avatar_url,
		       c.is_private, COALESCE(c.invite_token,'') as invite_token,
		       c.created_by, c.created_at, c.updated_at,
			   (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = c.id) as member_count
		FROM ptt_channel_members cm
		JOIN ptt_channels c ON cm.channel_id = c.id
		WHERE cm.user_id = $1
		ORDER BY c.name ASC
	`
	var channels []models.Channel
	if err := r.db.Select(&channels, query, userID); err != nil {
		return nil, err
	}
	if channels == nil {
		channels = []models.Channel{}
	}
	return channels, nil
}

func (r *ChannelRepository) DeleteChannel(id uuid.UUID) error {
	query := `DELETE FROM ptt_channels WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *ChannelRepository) UpdateChannel(id uuid.UUID, req models.UpdateChannelRequest) (*models.Channel, error) {
	query := `
		UPDATE ptt_channels
		SET name        = COALESCE(NULLIF($2, ''), name),
		    description = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
		    avatar_url  = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE avatar_url END,
		    is_private  = COALESCE($5, is_private),
		    updated_at  = NOW()
		WHERE id = $1
		RETURNING id, name, COALESCE(description,'') as description,
		          COALESCE(avatar_url,'') as avatar_url,
		          is_private, COALESCE(invite_token,'') as invite_token,
		          created_by, created_at, updated_at
	`
	var ch models.Channel
	if err := r.db.QueryRowx(query, id, req.Name, req.Description, req.AvatarURL, req.IsPrivate).StructScan(&ch); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) GetByInviteToken(token string) (*models.Channel, error) {
	var ch models.Channel
	query := `SELECT id, name, COALESCE(description,'') as description, COALESCE(avatar_url,'') as avatar_url,
	           is_private, COALESCE(invite_token,'') as invite_token, created_by, created_at, updated_at
	           FROM ptt_channels WHERE invite_token = $1`
	if err := r.db.Get(&ch, query, token); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) GenerateInviteToken(channelID uuid.UUID) (string, error) {
	token := channelID.String()[:8]
	query := `UPDATE ptt_channels SET invite_token = $2 WHERE id = $1 RETURNING invite_token`
	var t string
	if err := r.db.QueryRow(query, channelID, token).Scan(&t); err != nil {
		return "", err
	}
	return t, nil
}

func (r *ChannelRepository) GetMembersWithRole(channelID uuid.UUID) ([]models.ChannelMember, error) {
	query := `
		SELECT cm.channel_id, cm.user_id, cm.role, cm.joined_at,
			u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.is_online, u.status
		FROM ptt_channel_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.channel_id = $1
		ORDER BY cm.role DESC, u.first_name ASC
	`
	rows, err := r.db.Queryx(query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []models.ChannelMember
	for rows.Next() {
		var cm models.ChannelMember
		var u models.User
		if err := rows.Scan(&cm.ChannelID, &cm.UserID, &cm.Role, &cm.JoinedAt,
			&u.ID, &u.Username, &u.FirstName, &u.LastName, &u.AvatarURL, &u.IsOnline, &u.Status); err != nil {
			continue
		}
		cm.User = &u
		members = append(members, cm)
	}
	if members == nil {
		members = []models.ChannelMember{}
	}
	return members, nil
}

func (r *ChannelRepository) ListChannelsByOrg(orgID uuid.UUID) ([]models.Channel, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description,'') as description,
		       COALESCE(c.avatar_url,'') as avatar_url,
		       c.is_private, COALESCE(c.invite_token,'') as invite_token,
		       c.created_by, c.organization_id, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = c.id) as member_count
		FROM ptt_channels c
		WHERE c.organization_id = $1
		ORDER BY c.is_private ASC, c.name ASC
	`
	var channels []models.Channel
	if err := r.db.Select(&channels, query, orgID); err != nil {
		return nil, err
	}
	if channels == nil {
		channels = []models.Channel{}
	}
	return channels, nil
}

func (r *ChannelRepository) GetOrgChannel(orgID, channelID uuid.UUID) (*models.Channel, error) {
	var ch models.Channel
	query := `
		SELECT id, name, COALESCE(description,'') as description,
		       COALESCE(avatar_url,'') as avatar_url,
		       is_private, COALESCE(invite_token,'') as invite_token,
		       created_by, organization_id, created_at, updated_at,
		       (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = ptt_channels.id) as member_count
		FROM ptt_channels
		WHERE id = $1 AND organization_id = $2
	`
	if err := r.db.Get(&ch, query, channelID, orgID); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) FindDriverPTTChannel(orgID, driverID uuid.UUID) (*models.Channel, error) {
	marker := fmt.Sprintf("driver-ptt:%s", driverID.String())
	return r.FindOrgChannelByMarker(orgID, marker)
}

func (r *ChannelRepository) FindOrgChannelByMarker(orgID uuid.UUID, marker string) (*models.Channel, error) {
	var ch models.Channel
	query := `
		SELECT id, name, COALESCE(description,'') as description,
		       COALESCE(avatar_url,'') as avatar_url,
		       is_private, COALESCE(invite_token,'') as invite_token,
		       created_by, organization_id, created_at, updated_at,
		       (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = ptt_channels.id) as member_count
		FROM ptt_channels
		WHERE organization_id = $1 AND description = $2
		LIMIT 1
	`
	if err := r.db.Get(&ch, query, orgID, marker); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) FindOrgChannelByName(orgID uuid.UUID, name string) (*models.Channel, error) {
	var ch models.Channel
	query := `
		SELECT id, name, COALESCE(description,'') as description,
		       COALESCE(avatar_url,'') as avatar_url,
		       is_private, COALESCE(invite_token,'') as invite_token,
		       created_by, organization_id, created_at, updated_at,
		       (SELECT COUNT(*) FROM ptt_channel_members WHERE channel_id = ptt_channels.id) as member_count
		FROM ptt_channels
		WHERE organization_id = $1 AND lower(name) = lower($2)
		LIMIT 1
	`
	if err := r.db.Get(&ch, query, orgID, name); err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) SetChannelPrivate(channelID uuid.UUID, isPrivate bool) error {
	_, err := r.db.Exec(`UPDATE ptt_channels SET is_private = $2, updated_at = NOW() WHERE id = $1`, channelID, isPrivate)
	return err
}

// ClaimOrphanChannelsForOrg attaches legacy channels (organization_id IS NULL)
// that already have org members so portal delete/list stay consistent.
func (r *ChannelRepository) ClaimOrphanChannelsForOrg(orgID uuid.UUID) error {
	_, err := r.db.Exec(`
		UPDATE ptt_channels c
		SET organization_id = $1, updated_at = NOW()
		WHERE c.organization_id IS NULL
		  AND EXISTS (
			SELECT 1 FROM ptt_channel_members cm
			JOIN user_organizations uo ON uo.user_id = cm.user_id AND uo.organization_id = $1
			WHERE cm.channel_id = c.id
		  )
	`, orgID)
	return err
}

func (r *ChannelRepository) DeleteOrgChannel(orgID, channelID uuid.UUID) error {
	res, err := r.db.Exec(`
		DELETE FROM ptt_channels c
		WHERE c.id = $1
		  AND (
			c.organization_id = $2
			OR (
			  c.organization_id IS NULL
			  AND EXISTS (
				SELECT 1 FROM ptt_channel_members cm
				JOIN user_organizations uo ON uo.user_id = cm.user_id AND uo.organization_id = $2
				WHERE cm.channel_id = c.id
			  )
			)
		  )
	`, channelID, orgID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("channel not found")
	}
	return nil
}

func (r *ChannelRepository) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS ptt_channels (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			description TEXT DEFAULT '',
			created_by UUID NOT NULL REFERENCES users(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ptt_channel_members (
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role VARCHAR(20) NOT NULL DEFAULT 'member',
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (channel_id, user_id)
		)`,
		`ALTER TABLE ptt_channel_members ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'member'`,
		`ALTER TABLE ptt_channels ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE ptt_channels ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_ptt_channels_invite_token ON ptt_channels(invite_token) WHERE invite_token IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS ptt_emergency_alerts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			message TEXT NOT NULL DEFAULT 'EMERGENCY',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'available'`,
		`ALTER TABLE ptt_channels ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''`,
		`ALTER TABLE ptt_channels ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL`,
		`CREATE INDEX IF NOT EXISTS idx_ptt_channels_org ON ptt_channels(organization_id)`,
	}
	for _, q := range queries {
		if _, err := r.db.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

var _ = sql.ErrNoRows
