package repository

import (
	"fmt"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ChannelMessageRepository struct {
	db *sqlx.DB
}

func NewChannelMessageRepository(db *sqlx.DB) *ChannelMessageRepository {
	return &ChannelMessageRepository{db: db}
}

func (r *ChannelMessageRepository) CreateMessage(msg *models.ChannelMessage) error {
	query := `
		INSERT INTO ptt_channel_messages (id, channel_id, sender_id, content, type, file_url, file_name, file_size, reply_to_id, forwarded_from)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	return r.db.QueryRowx(query,
		msg.ID, msg.ChannelID, msg.SenderID, msg.Content, msg.Type,
		msg.FileURL, msg.FileName, msg.FileSize, msg.ReplyToID, msg.ForwardedFrom,
	).Scan(&msg.ID, &msg.CreatedAt)
}

func (r *ChannelMessageRepository) GetMessageByID(id uuid.UUID) (*models.ChannelMessage, error) {
	query := `
		SELECT m.id, m.channel_id, m.sender_id, m.content, m.type, m.file_url, m.file_name, m.file_size, m.reply_to_id, m.forwarded_from, m.is_deleted, m.created_at,
			u.id as "sender.id", u.username as "sender.username", u.first_name as "sender.first_name",
			u.last_name as "sender.last_name", u.avatar_url as "sender.avatar_url"
		FROM ptt_channel_messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.id = $1
	`
	var msg models.ChannelMessage
	if err := r.db.Get(&msg, query, id); err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *ChannelMessageRepository) GetChannelMessages(channelID uuid.UUID, limit, offset int) ([]models.ChannelMessage, error) {
	query := `
		SELECT m.id, m.channel_id, m.sender_id, m.content, m.type, m.file_url, m.file_name, m.file_size, m.reply_to_id, m.forwarded_from, m.is_deleted, m.created_at,
			u.id as "sender.id", u.username as "sender.username", u.first_name as "sender.first_name",
			u.last_name as "sender.last_name", u.avatar_url as "sender.avatar_url"
		FROM ptt_channel_messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.channel_id = $1
		ORDER BY m.created_at ASC
		LIMIT $2 OFFSET $3
	`
	var messages []models.ChannelMessage
	if err := r.db.Select(&messages, query, channelID, limit, offset); err != nil {
		return nil, fmt.Errorf("failed to get channel messages: %w", err)
	}
	if messages == nil {
		messages = []models.ChannelMessage{}
	}
	return messages, nil
}

func (r *ChannelMessageRepository) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS ptt_channel_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id UUID NOT NULL REFERENCES ptt_channels(id) ON DELETE CASCADE,
			sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content TEXT DEFAULT '',
			type VARCHAR(20) NOT NULL DEFAULT 'text',
			file_url VARCHAR(500) DEFAULT '',
			file_name VARCHAR(255) DEFAULT '',
			file_size BIGINT DEFAULT 0,
			reply_to_id UUID REFERENCES ptt_channel_messages(id) ON DELETE SET NULL,
			forwarded_from UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE ptt_channel_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES ptt_channel_messages(id) ON DELETE SET NULL`,
		`ALTER TABLE ptt_channel_messages ADD COLUMN IF NOT EXISTS forwarded_from UUID REFERENCES users(id) ON DELETE SET NULL`,
		`ALTER TABLE ptt_channel_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false`,
		`CREATE TABLE IF NOT EXISTS ptt_message_reactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			message_id UUID NOT NULL REFERENCES ptt_channel_messages(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			emoji VARCHAR(10) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(message_id, user_id, emoji)
		)`,
	}
	for _, q := range queries {
		if _, err := r.db.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

func (r *ChannelMessageRepository) AddReaction(messageID, userID uuid.UUID, emoji string) error {
	query := `INSERT INTO ptt_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.Exec(query, messageID, userID, emoji)
	return err
}

func (r *ChannelMessageRepository) RemoveReaction(messageID, userID uuid.UUID, emoji string) error {
	query := `DELETE FROM ptt_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`
	_, err := r.db.Exec(query, messageID, userID, emoji)
	return err
}

func (r *ChannelMessageRepository) GetMessageReactions(messageID uuid.UUID) ([]models.Reaction, error) {
	query := `
		SELECT r.id, r.message_id, r.user_id, r.emoji, r.created_at,
			u.id as "user.id", u.username as "user.username", u.first_name as "user.first_name",
			u.last_name as "user.last_name"
		FROM ptt_message_reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.message_id = $1
		ORDER BY r.created_at ASC
	`
	var reactions []models.Reaction
	if err := r.db.Select(&reactions, query, messageID); err != nil {
		return nil, err
	}
	return reactions, nil
}

func (r *ChannelMessageRepository) DeleteMessage(messageID, userID uuid.UUID) error {
	query := `UPDATE ptt_channel_messages SET is_deleted = true, content = '', file_url = '', file_name = '' WHERE id = $1 AND sender_id = $2`
	_, err := r.db.Exec(query, messageID, userID)
	return err
}
