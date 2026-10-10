package repository

import (
	"fmt"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
)

type MessageRepository struct {
	db *Database
}

func NewMessageRepository(db *Database) *MessageRepository {
	return &MessageRepository{db: db}
}

func (r *MessageRepository) CreateConversation(conversation *models.Conversation, participantIDs []uuid.UUID) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO conversations (id, type, name, avatar_url, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, type, name, avatar_url, description, created_by, created_at, updated_at
	`

	err = tx.QueryRow(query,
		conversation.ID,
		conversation.Type,
		conversation.Name,
		conversation.AvatarURL,
		conversation.Description,
		conversation.CreatedBy,
	).Scan(
		&conversation.ID,
		&conversation.Type,
		&conversation.Name,
		&conversation.AvatarURL,
		&conversation.Description,
		&conversation.CreatedBy,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)

	if err != nil {
		return err
	}

	for _, participantID := range participantIDs {
		_, err = tx.Exec(
			`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			conversation.ID,
			participantID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *MessageRepository) AddParticipantToConversation(conversationID uuid.UUID, userID uuid.UUID) error {
	query := `
		INSERT INTO conversation_participants (conversation_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`
	_, err := r.db.Exec(query, conversationID, userID)
	return err
}

func (r *MessageRepository) UpdateConversation(conversationID uuid.UUID, name string, description string, avatarURL string) error {
	query := `
		UPDATE conversations
		SET name = $2, description = $3, avatar_url = $4, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(query, conversationID, name, description, avatarURL)
	return err
}

func (r *MessageRepository) GetUserConversations(userID uuid.UUID) ([]models.Conversation, error) {
	query := `
		SELECT DISTINCT c.id, c.type, c.name, c.avatar_url, c.description, c.created_by, c.created_at, c.updated_at
		FROM conversation_participants cp
		JOIN conversations c ON cp.conversation_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC
	`

	var conversations []models.Conversation
	err := r.db.Select(&conversations, query, userID)
	if err != nil {
		return nil, err
	}

	for i := range conversations {
		msg, err := r.GetLastMessage(conversations[i].ID)
		if err != nil {
			// Log error but don't fail - just set to nil
			fmt.Printf("Error getting last message for conversation %s: %v\n", conversations[i].ID, err)
		}
		conversations[i].LastMessage = msg

		count, err := r.GetUnreadCount(conversations[i].ID, userID)
		if err != nil {
			// Log error but don't fail - just set to 0
			fmt.Printf("Error getting unread count for conversation %s: %v\n", conversations[i].ID, err)
			count = 0
		}
		conversations[i].UnreadCount = count

		// Load participants for display name calculation
		participants, err := r.GetConversationParticipants(conversations[i].ID)
		if err != nil {
			fmt.Printf("Error getting participants for conversation %s: %v\n", conversations[i].ID, err)
		}
		conversations[i].Participants = participants
	}

	return conversations, nil
}

func (r *MessageRepository) GetLastMessage(conversationID uuid.UUID) (*models.Message, error) {
	var msg models.Message
	query := `
		SELECT id, conversation_id, sender_id, content, message_type, file_url, duration, reply_to_id, forwarded_from, is_edited, is_deleted, is_pinned, created_at, updated_at
		FROM messages
		WHERE conversation_id = $1 AND is_deleted = false
		ORDER BY created_at DESC LIMIT 1
	`
	err := r.db.Get(&msg, query, conversationID)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *MessageRepository) GetUnreadCount(conversationID, userID uuid.UUID) (int, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM messages m
		WHERE m.conversation_id = $1
		  AND m.sender_id != $2
		  AND m.is_deleted = false
		  AND NOT EXISTS (
			SELECT 1 FROM message_reads mr
			WHERE mr.message_id = m.id AND mr.user_id = $2
		  )
	`
	err := r.db.Get(&count, query, conversationID, userID)
	return count, err
}

func (r *MessageRepository) GetConversationParticipants(conversationID uuid.UUID) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email, u.phone, u.first_name, u.last_name, u.avatar_url, u.bio, u.is_online, u.last_seen, u.created_at, u.updated_at
		FROM conversation_participants cp
		JOIN users u ON cp.user_id = u.id
		WHERE cp.conversation_id = $1
	`

	var users []models.User
	err := r.db.Select(&users, query, conversationID)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (r *MessageRepository) GetMessages(conversationID uuid.UUID, limit int, before *string) ([]models.Message, error) {
	query := `
		SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.file_url, m.duration, m.reply_to_id, m.forwarded_from, m.is_edited, m.is_deleted, m.is_pinned, m.created_at, m.updated_at
		FROM messages m
		WHERE m.conversation_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2
	`

	var messages []models.Message
	err := r.db.Select(&messages, query, conversationID, limit)
	if err != nil {
		return nil, err
	}

	return messages, nil
}

func (r *MessageRepository) GetMessageByID(messageID uuid.UUID) (*models.Message, error) {
	var msg models.Message
	query := `
		SELECT id, conversation_id, sender_id, content, message_type, file_url, reply_to_id, forwarded_from, is_edited, is_deleted, is_pinned, created_at, updated_at
		FROM messages
		WHERE id = $1
	`
	err := r.db.Get(&msg, query, messageID)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (r *MessageRepository) CreateMessage(message *models.Message) error {
	query := `
		INSERT INTO messages (id, conversation_id, sender_id, content, message_type, file_url, reply_to_id, forwarded_from, is_pinned)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
		RETURNING id, conversation_id, sender_id, content, message_type, file_url, reply_to_id, forwarded_from, is_edited, is_deleted, is_pinned, created_at, updated_at
	`

	err := r.db.QueryRow(query,
		message.ID,
		message.ConversationID,
		message.SenderID,
		message.Content,
		message.MessageType,
		message.FileURL,
		message.ReplyToID,
		message.ForwardedFrom,
	).Scan(
		&message.ID,
		&message.ConversationID,
		&message.SenderID,
		&message.Content,
		&message.MessageType,
		&message.FileURL,
		&message.ReplyToID,
		&message.ForwardedFrom,
		&message.IsEdited,
		&message.IsDeleted,
		&message.IsPinned,
		&message.CreatedAt,
		&message.UpdatedAt,
	)

	if err != nil {
		return err
	}

	_, err = r.db.Exec(
		"UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
		message.ConversationID,
	)

	return err
}

func (r *MessageRepository) UpdateMessage(messageID uuid.UUID, senderID uuid.UUID, content string) error {
	query := `
		UPDATE messages
		SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND sender_id = $3
	`

	_, err := r.db.Exec(query, content, messageID, senderID)
	return err
}

func (r *MessageRepository) DeleteMessage(messageID uuid.UUID, senderID uuid.UUID) error {
	query := `
		UPDATE messages
		SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND sender_id = $2
	`

	_, err := r.db.Exec(query, messageID, senderID)
	return err
}

func (r *MessageRepository) FindPrivateConversation(userID1, userID2 uuid.UUID) (*models.Conversation, error) {
	query := `
		SELECT c.id, c.type, c.name, c.avatar_url, c.created_by, c.created_at, c.updated_at
		FROM conversations c
		JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
		JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
		WHERE c.type = 'private'
		LIMIT 1
	`
	var conv models.Conversation
	err := r.db.Get(&conv, query, userID1, userID2)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *MessageRepository) GetOrCreatePrivateConversation(userID1, userID2 uuid.UUID) (*models.Conversation, error) {
	existing, err := r.FindPrivateConversation(userID1, userID2)
	if err == nil && existing != nil {
		return existing, nil
	}

	conv := &models.Conversation{
		ID:        uuid.New(),
		Type:      "private",
		CreatedBy: userID1,
	}
	if err := r.CreateConversation(conv, []uuid.UUID{userID1, userID2}); err != nil {
		return nil, err
	}
	return conv, nil
}

func (r *MessageRepository) GetConversationByID(conversationID uuid.UUID) (*models.Conversation, error) {
	var conv models.Conversation
	query := `
		SELECT id, type, name, avatar_url, description, created_by, created_at, updated_at
		FROM conversations WHERE id = $1
	`
	err := r.db.Get(&conv, query, conversationID)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *MessageRepository) IsParticipant(conversationID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.Get(&exists, `
		SELECT EXISTS(
			SELECT 1 FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
		)
	`, conversationID, userID)
	return exists, err
}

func (r *MessageRepository) RemoveParticipant(conversationID, userID uuid.UUID) error {
	_, err := r.db.Exec(
		`DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
		conversationID, userID,
	)
	return err
}

func (r *MessageRepository) CountParticipants(conversationID uuid.UUID) (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = $1`, conversationID)
	return count, err
}

func (r *MessageRepository) DeleteConversation(conversationID uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM conversations WHERE id = $1`, conversationID)
	return err
}

func (r *MessageRepository) MarkAsRead(messageID uuid.UUID, userID uuid.UUID) error {
	query := `
		INSERT INTO message_reads (message_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (message_id, user_id) DO UPDATE
		SET read_at = CURRENT_TIMESTAMP
	`

	_, err := r.db.Exec(query, messageID, userID)
	return err
}

func (r *MessageRepository) MarkConversationAsRead(conversationID uuid.UUID, userID uuid.UUID) error {
	query := `
		INSERT INTO message_reads (message_id, user_id)
		SELECT id, $2 FROM messages
		WHERE conversation_id = $1
		ON CONFLICT (message_id, user_id) DO UPDATE
		SET read_at = CURRENT_TIMESTAMP
	`

	_, err := r.db.Exec(query, conversationID, userID)
	return err
}

func (r *MessageRepository) PinMessage(messageID uuid.UUID) error {
	query := `
		UPDATE messages
		SET is_pinned = true, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`

	_, err := r.db.Exec(query, messageID)
	return err
}

func (r *MessageRepository) UnpinMessage(messageID uuid.UUID) error {
	query := `
		UPDATE messages
		SET is_pinned = false, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`

	_, err := r.db.Exec(query, messageID)
	return err
}
