package repository

import (
	"database/sql"
	"telegram-clone/internal/models"
	"time"

	"github.com/google/uuid"
)

type CallRepository struct {
	db *Database
}

func NewCallRepository(db *Database) *CallRepository {
	return &CallRepository{db: db}
}

func (r *CallRepository) CreateCall(call *models.Call) error {
	query := `
		INSERT INTO calls (id, conversation_id, initiated_by, call_type, livekit_room_name, status, call_result, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Exec(query,
		call.ID, call.ConversationID, call.InitiatedBy, call.CallType,
		call.LiveKitRoomName, call.Status, call.CallResult, call.StartedAt,
	)
	return err
}

func (r *CallRepository) UpdateCall(call *models.Call) error {
	query := `
		UPDATE calls SET status = $2, call_result = $3, ended_at = $4
		WHERE id = $1
	`
	_, err := r.db.Exec(query, call.ID, call.Status, call.CallResult, call.EndedAt)
	return err
}

func (r *CallRepository) GetCallByID(id uuid.UUID) (*models.Call, error) {
	var call models.Call
	query := `SELECT id, conversation_id, initiated_by, call_type, livekit_room_name, status, call_result, started_at, ended_at FROM calls WHERE id = $1`
	err := r.db.Get(&call, query, id)
	if err != nil {
		return nil, err
	}
	return &call, nil
}

func (r *CallRepository) AddParticipant(callID, userID uuid.UUID, status string) error {
	query := `
		INSERT INTO call_participants (id, call_id, user_id, call_status, joined_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (call_id, user_id) DO UPDATE SET call_status = $4, joined_at = $5
	`
	now := time.Now()
	_, err := r.db.Exec(query, uuid.New(), callID, userID, status, now)
	return err
}

func (r *CallRepository) GetUserCallHistory(userID uuid.UUID, filter string, limit int) ([]models.CallHistoryItem, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT DISTINCT c.id, c.conversation_id, c.initiated_by, c.call_type, c.livekit_room_name,
			c.status, c.call_result, c.started_at, c.ended_at,
			u.id as other_user_id, u.username as other_username, u.first_name as other_first_name,
			u.last_name as other_last_name, u.avatar_url as other_avatar_url, u.phone as other_phone
		FROM calls c
		JOIN conversation_participants cp ON cp.conversation_id = c.conversation_id AND cp.user_id = $1
		JOIN conversation_participants cp2 ON cp2.conversation_id = c.conversation_id AND cp2.user_id != $1
		JOIN users u ON u.id = cp2.user_id
		WHERE c.status IN ('ended', 'missed', 'rejected', 'busy', 'active', 'ringing')
	`
	args := []interface{}{userID}

	switch filter {
	case "missed":
		query += ` AND c.call_result IN ('missed', 'rejected') AND c.initiated_by != $1`
	}

	query += ` ORDER BY c.started_at DESC LIMIT $2`
	args = append(args, limit)

	var items []models.CallHistoryItem
	err := r.db.Select(&items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *CallRepository) GetConversationCalls(conversationID uuid.UUID, currentUserID uuid.UUID) ([]models.CallHistoryItem, error) {
	query := `
		SELECT DISTINCT c.id, c.conversation_id, c.initiated_by, c.call_type, c.livekit_room_name,
			c.status, c.call_result, c.started_at, c.ended_at,
			u.id as other_user_id, u.username as other_username, u.first_name as other_first_name,
			u.last_name as other_last_name, u.avatar_url as other_avatar_url, u.phone as other_phone
		FROM calls c
		JOIN conversation_participants cp ON cp.conversation_id = c.conversation_id AND cp.user_id = $2
		JOIN conversation_participants cp2 ON cp2.conversation_id = c.conversation_id AND cp2.user_id != $2
		JOIN users u ON u.id = cp2.user_id
		WHERE c.conversation_id = $1
		ORDER BY c.started_at ASC
	`
	var items []models.CallHistoryItem
	err := r.db.Select(&items, query, conversationID, currentUserID)
	if items == nil {
		items = []models.CallHistoryItem{}
	}
	return items, err
}

func (r *CallRepository) CreateNotification(n *models.Notification) error {
	query := `
		INSERT INTO notifications (id, user_id, type, title, body, data)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.Exec(query, n.ID, n.UserID, n.Type, n.Title, n.Body, n.Data)
	return err
}

func (r *CallRepository) GetNotifications(userID uuid.UUID, limit int) ([]models.Notification, error) {
	if limit <= 0 {
		limit = 30
	}
	var notifications []models.Notification
	query := `
		SELECT id, user_id, type, title, body, data, is_read, created_at
		FROM notifications WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2
	`
	err := r.db.Select(&notifications, query, userID, limit)
	return notifications, err
}

func (r *CallRepository) MarkNotificationsRead(userID uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE notifications SET is_read = true WHERE user_id = $1`, userID)
	return err
}

func (r *CallRepository) CountUnreadNotifications(userID uuid.UUID) (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, userID)
	return count, err
}

// ── Push Subscriptions ────────────────────────────────────────────────────

func (r *CallRepository) UpsertPushSubscription(userID uuid.UUID, endpoint, p256dh, auth string) error {
	_, err := r.db.Exec(`
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4
	`, userID, endpoint, p256dh, auth)
	return err
}

func (r *CallRepository) DeletePushSubscription(userID uuid.UUID, endpoint string) error {
	_, err := r.db.Exec(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	return err
}

type PushSubscriptionRow struct {
	Endpoint string `db:"endpoint"`
	P256DH   string `db:"p256dh"`
	Auth     string `db:"auth"`
}

func (r *CallRepository) GetPushSubscriptions(userID uuid.UUID) ([]PushSubscriptionRow, error) {
	var subs []PushSubscriptionRow
	err := r.db.Select(&subs, `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, userID)
	return subs, err
}

func NullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}
