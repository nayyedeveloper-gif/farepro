package handlers

import (
	"log"
	"net/http"
	"strconv"

	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChannelMessageHandler struct {
	msgRepo     *repository.ChannelMessageRepository
	channelRepo *repository.ChannelRepository
	userRepo    *repository.UserRepository
}

func NewChannelMessageHandler(
	msgRepo *repository.ChannelMessageRepository,
	channelRepo *repository.ChannelRepository,
	userRepo *repository.UserRepository,
) *ChannelMessageHandler {
	return &ChannelMessageHandler{
		msgRepo:     msgRepo,
		channelRepo: channelRepo,
		userRepo:    userRepo,
	}
}

func (h *ChannelMessageHandler) SendMessage(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	var req models.SendChannelMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type == "" {
		req.Type = "text"
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

	msg := &models.ChannelMessage{
		ID:            uuid.New(),
		ChannelID:     channelID,
		SenderID:      userID,
		Content:       req.Content,
		Type:          req.Type,
		FileURL:       req.FileURL,
		FileName:      req.FileName,
		FileSize:      req.FileSize,
		ReplyToID:     replyToID,
		ForwardedFrom: forwardedFrom,
	}

	if err := h.msgRepo.CreateMessage(msg); err != nil {
		log.Printf("[ChannelMessageHandler] CreateMessage error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}

	sender, _ := h.userRepo.GetByID(userID)
	msg.Sender = sender

	if replyToID != nil {
		replyMsg, err := h.msgRepo.GetMessageByID(*replyToID)
		if err == nil {
			msg.ReplyToMessage = replyMsg
		}
	}

	if forwardedFrom != nil {
		fwdUser, err := h.userRepo.GetByID(*forwardedFrom)
		if err == nil {
			msg.ForwardedUser = fwdUser
		}
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	var memberIDs []uuid.UUID
	for _, m := range members {
		if m.ID != userID {
			memberIDs = append(memberIDs, m.ID)
		}
	}
	socket.BroadcastToUsers(memberIDs, "channel.message", msg)

	c.JSON(http.StatusCreated, msg)
}

func (h *ChannelMessageHandler) GetMessages(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	limit := 50
	offset := 0
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
		offset = o
	}

	messages, err := h.msgRepo.GetChannelMessages(channelID, limit, offset)
	if err != nil {
		log.Printf("[ChannelMessageHandler] GetMessages error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *ChannelMessageHandler) ToggleReaction(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	messageID, err := uuid.Parse(c.Param("msgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	var req models.ReactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, _ := h.msgRepo.GetMessageReactions(messageID)
	hasReaction := false
	for _, r := range existing {
		if r.UserID == userID && r.Emoji == req.Emoji {
			hasReaction = true
			break
		}
	}

	if hasReaction {
		_ = h.msgRepo.RemoveReaction(messageID, userID, req.Emoji)
	} else {
		_ = h.msgRepo.AddReaction(messageID, userID, req.Emoji)
	}

	reactions, _ := h.msgRepo.GetMessageReactions(messageID)

	msg, _ := h.msgRepo.GetMessageByID(messageID)
	if msg != nil {
		members, _ := h.channelRepo.GetChannelMembers(msg.ChannelID)
		var memberIDs []uuid.UUID
		for _, m := range members {
			if m.ID != userID {
				memberIDs = append(memberIDs, m.ID)
			}
		}
		socket.BroadcastToUsers(memberIDs, "channel.reaction", gin.H{
			"messageId": messageID.String(),
			"channelId": msg.ChannelID.String(),
			"reactions": reactions,
		})
	}

	c.JSON(http.StatusOK, gin.H{"reactions": reactions})
}

func (h *ChannelMessageHandler) DeleteMessage(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	messageID, err := uuid.Parse(c.Param("msgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	msg, err := h.msgRepo.GetMessageByID(messageID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	if msg.SenderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Can only delete your own messages"})
		return
	}

	if err := h.msgRepo.DeleteMessage(messageID, userID); err != nil {
		log.Printf("[ChannelMessageHandler] DeleteMessage error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(msg.ChannelID)
	var memberIDs []uuid.UUID
	for _, m := range members {
		if m.ID != userID {
			memberIDs = append(memberIDs, m.ID)
		}
	}
	socket.BroadcastToUsers(memberIDs, "channel.message_deleted", gin.H{
		"messageId": messageID.String(),
		"channelId": msg.ChannelID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *ChannelMessageHandler) SendEmergencyAlert(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Content == "" {
		req.Content = "EMERGENCY ALERT"
	}

	msg := &models.ChannelMessage{
		ID:        uuid.New(),
		ChannelID: channelID,
		SenderID:  userID,
		Content:   req.Content,
		Type:      "emergency",
	}

	if err := h.msgRepo.CreateMessage(msg); err != nil {
		log.Printf("[ChannelMessageHandler] Emergency alert error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send alert"})
		return
	}

	sender, _ := h.userRepo.GetByID(userID)
	msg.Sender = sender

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	var memberIDs []uuid.UUID
	for _, m := range members {
		if m.ID != userID {
			memberIDs = append(memberIDs, m.ID)
		}
	}
	socket.BroadcastToUsers(memberIDs, "channel.message", msg)
	socket.BroadcastToUsers(memberIDs, "channel.emergency", msg)

	c.JSON(http.StatusCreated, msg)
}
