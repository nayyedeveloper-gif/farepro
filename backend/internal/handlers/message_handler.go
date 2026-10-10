package handlers

import (
	"fmt"
	"net/http"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MessageHandler struct {
	messageRepo *repository.MessageRepository
	userRepo    *repository.UserRepository
}

func NewMessageHandler(messageRepo *repository.MessageRepository, userRepo *repository.UserRepository) *MessageHandler {
	return &MessageHandler{
		messageRepo: messageRepo,
		userRepo:    userRepo,
	}
}

func (h *MessageHandler) CreateConversation(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	participantIDs := []uuid.UUID{userID}
	for _, pid := range req.ParticipantIDs {
		id, err := uuid.Parse(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant ID"})
			return
		}
		participantIDs = append(participantIDs, id)
	}

	conversation := &models.Conversation{
		ID:        uuid.New(),
		Type:      req.Type,
		Name:      req.Name,
		CreatedBy: userID,
	}

	if err := h.messageRepo.CreateConversation(conversation, participantIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	c.JSON(http.StatusCreated, conversation)
}

func (h *MessageHandler) JoinChannel(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.JoinChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	channelID, err := uuid.Parse(req.ChannelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if err := h.messageRepo.AddParticipantToConversation(channelID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join channel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined channel"})
}

func (h *MessageHandler) AddMembers(c *gin.Context) {
	var req models.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conversationID, err := uuid.Parse(req.ConversationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	// Check if user is admin/creator of the conversation
	// For now, allow anyone to add members (simplified)

	for _, uidStr := range req.UserIDs {
		uid, err := uuid.Parse(uidStr)
		if err != nil {
			continue // Skip invalid IDs
		}
		if err := h.messageRepo.AddParticipantToConversation(conversationID, uid); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully added members"})
}

func (h *MessageHandler) UpdateConversation(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	var req models.UpdateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user is admin/creator of the conversation
	// For now, allow anyone to update (simplified)

	if err := h.messageRepo.UpdateConversation(conversationID, req.Name, req.Description, req.AvatarURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update conversation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully updated conversation"})
}

func (h *MessageHandler) GetConversations(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	conversations, err := h.messageRepo.GetUserConversations(userID)
	if err != nil {
		fmt.Printf("[GetConversations] Error fetching conversations for user %s: %v\n", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get conversations", "details": err.Error()})
		return
	}

	// Add participants to each conversation
	for i := range conversations {
		participants, err := h.messageRepo.GetConversationParticipants(conversations[i].ID)
		if err == nil {
			conversations[i].Participants = participants
		}
		// Log conversation ID for debugging
		fmt.Printf("[GetConversations] Conversation ID: %s, Length: %d\n", conversations[i].ID, len(conversations[i].ID.String()))
	}

	if conversations == nil {
		conversations = []models.Conversation{}
	}

	c.JSON(http.StatusOK, conversations)
}

func (h *MessageHandler) GetMessages(c *gin.Context) {
	idParam := c.Param("id")
	conversationID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID", "provided_id": idParam, "parse_error": err.Error()})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := parseInt(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	var before *string
	if b := c.Query("before"); b != "" {
		before = &b
	}

	messages, err := h.messageRepo.GetMessages(conversationID, limit, before)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	// Add sender, replyToMessage, and forwardedUser info to each message
	for i := range messages {
		sender, err := h.userRepo.GetByID(messages[i].SenderID)
		if err == nil {
			messages[i].Sender = sender
		}
		// Populate replyToMessage
		if messages[i].ReplyToID != nil {
			replyMsg, err := h.messageRepo.GetMessageByID(*messages[i].ReplyToID)
			if err == nil && replyMsg != nil {
				replySender, _ := h.userRepo.GetByID(replyMsg.SenderID)
				replyMsg.Sender = replySender
				messages[i].ReplyToMessage = replyMsg
			}
		}
		// Populate forwardedUser
		if messages[i].ForwardedFrom != nil {
			forwardedUser, err := h.userRepo.GetByID(*messages[i].ForwardedFrom)
			if err == nil {
				messages[i].ForwardedUser = forwardedUser
			}
		}
	}

	if messages == nil {
		messages = []models.Message{}
	}

	c.JSON(http.StatusOK, messages)
}

func (h *MessageHandler) SendMessage(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var replyToID *uuid.UUID
	if req.ReplyToID != "" {
		id, err := uuid.Parse(req.ReplyToID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reply to ID"})
			return
		}
		replyToID = &id
	}

	var forwardedFrom *uuid.UUID
	if req.ForwardedFrom != "" {
		id, err := uuid.Parse(req.ForwardedFrom)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid forwarded from ID"})
			return
		}
		forwardedFrom = &id
	}

	message := &models.Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		SenderID:       userID,
		Content:        req.Content,
		MessageType:    req.MessageType,
		FileURL:        req.FileURL,
		Duration:       req.Duration,
		ReplyToID:      replyToID,
		ForwardedFrom:  forwardedFrom,
	}

	if err := h.messageRepo.CreateMessage(message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}

	// Add sender info
	sender, _ := h.userRepo.GetByID(message.SenderID)
	message.Sender = sender

	participants, _ := h.messageRepo.GetConversationParticipants(conversationID)
	var participantIDs []uuid.UUID
	for _, p := range participants {
		participantIDs = append(participantIDs, p.ID)
	}
	socket.BroadcastToUsers(participantIDs, socket.EventMessageNew, message)

	c.JSON(http.StatusCreated, message)
}

func (h *MessageHandler) UpdateMessage(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	var req models.UpdateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.messageRepo.UpdateMessage(messageID, userID, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message updated"})
}

func (h *MessageHandler) DeleteMessage(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	if err := h.messageRepo.DeleteMessage(messageID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

func (h *MessageHandler) DeleteConversation(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	conv, err := h.messageRepo.GetConversationByID(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	isParticipant, err := h.messageRepo.IsParticipant(conversationID, userID)
	if err != nil || !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a participant"})
		return
	}

	forEveryone := c.Query("forEveryone") == "true"
	participants, _ := h.messageRepo.GetConversationParticipants(conversationID)
	var participantIDs []uuid.UUID
	for _, p := range participants {
		participantIDs = append(participantIDs, p.ID)
	}

	if forEveryone && conv.CreatedBy == userID && (conv.Type == "group" || conv.Type == "channel") {
		if err := h.messageRepo.DeleteConversation(conversationID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete conversation"})
			return
		}
		socket.BroadcastToUsers(participantIDs, "conversation.deleted", gin.H{
			"conversationId": conversationID.String(),
			"forEveryone":    true,
		})
		c.JSON(http.StatusOK, gin.H{"message": "Conversation deleted for everyone"})
		return
	}

	if err := h.messageRepo.RemoveParticipant(conversationID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave conversation"})
		return
	}

	count, _ := h.messageRepo.CountParticipants(conversationID)
	if count == 0 {
		_ = h.messageRepo.DeleteConversation(conversationID)
	}

	socket.BroadcastToUsers(participantIDs, "conversation.deleted", gin.H{
		"conversationId": conversationID.String(),
		"userId":         userID.String(),
		"forEveryone":    false,
	})
	c.JSON(http.StatusOK, gin.H{"message": "Conversation removed"})
}

func (h *MessageHandler) MarkAsRead(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	// Use conversation ID from URL path to mark all messages as read
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	if err := h.messageRepo.MarkConversationAsRead(conversationID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Messages marked as read"})
}

func (h *MessageHandler) PinMessage(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	if err := h.messageRepo.PinMessage(messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pin message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message pinned"})
}

func (h *MessageHandler) UnpinMessage(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	if err := h.messageRepo.UnpinMessage(messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unpin message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message unpinned"})
}

func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
