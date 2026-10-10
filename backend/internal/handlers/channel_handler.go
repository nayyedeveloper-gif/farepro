package handlers

import (
	"log"
	"net/http"

	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChannelHandler struct {
	channelRepo *repository.ChannelRepository
}

func NewChannelHandler(channelRepo *repository.ChannelRepository) *ChannelHandler {
	return &ChannelHandler{channelRepo: channelRepo}
}

func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var orgID *uuid.UUID
	if v, ok := c.Get("orgID"); ok {
		id := v.(uuid.UUID)
		orgID = &id
	}

	ch, err := h.channelRepo.CreateChannelForOrg(req.Name, req.Description, userID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}

	// Creator joins as admin
	if err := h.channelRepo.JoinChannelAsAdmin(ch.ID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join channel as admin"})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

func (h *ChannelHandler) UpdateMemberRole(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	// Only admin can update roles
	role, err := h.channelRepo.GetMemberRole(channelID, userID)
	if err != nil || role != models.ChannelRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	var req models.UpdateChannelMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.channelRepo.UpdateMemberRole(channelID, targetID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role updated"})
}

func (h *ChannelHandler) KickMember(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	role, err := h.channelRepo.GetMemberRole(channelID, userID)
	if err != nil || role != models.ChannelRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.channelRepo.KickMember(channelID, targetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to kick member"})
		return
	}

	socket.SendEvent(targetID, "ptt.kicked", gin.H{"channelId": channelID.String()})
	c.JSON(http.StatusOK, gin.H{"message": "Member kicked"})
}

func (h *ChannelHandler) UpdateStatus(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req struct {
		Status models.UserStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != models.UserStatusAvailable && req.Status != models.UserStatusBusy && req.Status != models.UserStatusDND {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	if err := h.channelRepo.UpdateUserStatus(userID, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}

	// Broadcast status change to all connected clients
	socket.BroadcastToAll("ptt.status", gin.H{
		"userId": userID.String(),
		"status": req.Status,
	})

	c.JSON(http.StatusOK, gin.H{"status": req.Status})
}

func (h *ChannelHandler) SendEmergencyAlert(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Message == "" {
		req.Message = "EMERGENCY"
	}

	alert, err := h.channelRepo.CreateEmergencyAlert(channelID, userID, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert"})
		return
	}

	// Broadcast to all channel members
	members, _ := h.channelRepo.GetChannelMembers(channelID)
	for _, m := range members {
		socket.SendEvent(m.ID, "ptt.emergency", gin.H{
			"alertId":   alert.ID.String(),
			"channelId": channelID.String(),
			"userId":    userID.String(),
			"message":   alert.Message,
			"createdAt": alert.CreatedAt,
		})
	}

	c.JSON(http.StatusCreated, alert)
}

func (h *ChannelHandler) GetEmergencyAlerts(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	alerts, err := h.channelRepo.GetEmergencyAlerts(channelID, 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get alerts"})
		return
	}
	c.JSON(http.StatusOK, alerts)
}

func (h *ChannelHandler) ListChannels(c *gin.Context) {
	channels, err := h.channelRepo.ListChannels()
	if err != nil {
		log.Printf("[ChannelHandler] ListChannels error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list channels"})
		return
	}
	c.JSON(http.StatusOK, channels)
}

func (h *ChannelHandler) GetChannel(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	ch, err := h.channelRepo.GetChannelByID(channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	members, err := h.channelRepo.GetChannelMembers(channelID)
	if err == nil {
		ch.Members = members
		ch.MemberCount = len(members)
	}

	c.JSON(http.StatusOK, ch)
}

func (h *ChannelHandler) JoinChannel(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if err := h.channelRepo.JoinChannel(channelID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join channel"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	for _, m := range members {
		if m.ID != userID {
			socket.SendEvent(m.ID, "ptt.member_joined", gin.H{
				"channelId": channelID.String(),
				"userId":    userID.String(),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Joined channel"})
}

func (h *ChannelHandler) LeaveChannel(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if err := h.channelRepo.LeaveChannel(channelID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave channel"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	for _, m := range members {
		if m.ID != userID {
			socket.SendEvent(m.ID, "ptt.member_left", gin.H{
				"channelId": channelID.String(),
				"userId":    userID.String(),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Left channel"})
}

func (h *ChannelHandler) GetChannelMembers(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	members, err := h.channelRepo.GetChannelMembers(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
		return
	}
	if members == nil {
		members = []models.User{}
	}

	c.JSON(http.StatusOK, members)
}

func (h *ChannelHandler) GetUserChannels(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	channels, err := h.channelRepo.GetUserChannels(userID)
	if err != nil {
		log.Printf("[ChannelHandler] GetUserChannels error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channels"})
		return
	}

	c.JSON(http.StatusOK, channels)
}

func (h *ChannelHandler) UpdateChannel(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	role, err := h.channelRepo.GetMemberRole(channelID, userID)
	if err != nil || role != models.ChannelRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	var req models.UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := h.channelRepo.UpdateChannel(channelID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update channel"})
		return
	}

	socket.BroadcastToChannel(channelID, "ptt.channel_updated", gin.H{
		"channelId":   ch.ID.String(),
		"name":        ch.Name,
		"description": ch.Description,
		"isPrivate":   ch.IsPrivate,
	})

	c.JSON(http.StatusOK, ch)
}

func (h *ChannelHandler) DeleteChannelByAdmin(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	ch, err := h.channelRepo.GetChannelByID(channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if ch.CreatedBy != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only channel owner can delete"})
		return
	}

	socket.BroadcastToChannel(channelID, "ptt.channel_deleted", gin.H{
		"channelId": channelID.String(),
	})

	if err := h.channelRepo.DeleteChannel(channelID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete channel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Channel deleted"})
}

func (h *ChannelHandler) GetMembersWithRole(c *gin.Context) {
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	members, err := h.channelRepo.GetMembersWithRole(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
		return
	}
	c.JSON(http.StatusOK, members)
}

func (h *ChannelHandler) GetInviteToken(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	role, err := h.channelRepo.GetMemberRole(channelID, userID)
	if err != nil || role != models.ChannelRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	token, err := h.channelRepo.GenerateInviteToken(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate invite token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "channelId": channelID.String()})
}

func (h *ChannelHandler) JoinByInvite(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	token := c.Param("token")

	ch, err := h.channelRepo.GetByInviteToken(token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite link"})
		return
	}

	if err := h.channelRepo.JoinChannel(ch.ID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join channel"})
		return
	}

	members, _ := h.channelRepo.GetChannelMembers(ch.ID)
	for _, m := range members {
		if m.ID != userID {
			socket.SendEvent(m.ID, "ptt.member_joined", gin.H{
				"channelId": ch.ID.String(),
				"userId":    userID.String(),
			})
		}
	}

	c.JSON(http.StatusOK, ch)
}
