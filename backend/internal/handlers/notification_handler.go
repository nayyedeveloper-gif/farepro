package handlers

import (
	"encoding/json"
	"net/http"
	"telegram-clone/internal/models"
	"telegram-clone/internal/push"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationHandler struct {
	callRepo    *repository.CallRepository
	pushService *push.Service
}

func NewNotificationHandler(callRepo *repository.CallRepository, pushSvc *push.Service) *NotificationHandler {
	return &NotificationHandler{callRepo: callRepo, pushService: pushSvc}
}

func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	notifications, err := h.callRepo.GetNotifications(userID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get notifications"})
		return
	}
	if notifications == nil {
		notifications = []models.Notification{}
	}
	unread, _ := h.callRepo.CountUnreadNotifications(userID)
	c.JSON(http.StatusOK, gin.H{"notifications": notifications, "unreadCount": unread})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	if err := h.callRepo.MarkNotificationsRead(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// SavePushSubscription stores a Web Push subscription for the authenticated user.
func (h *NotificationHandler) SavePushSubscription(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	var body struct {
		Endpoint string `json:"endpoint" binding:"required"`
		P256DH   string `json:"p256dh"  binding:"required"`
		Auth     string `json:"auth"    binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription payload"})
		return
	}
	if err := h.callRepo.UpsertPushSubscription(userID, body.Endpoint, body.P256DH, body.Auth); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// DeletePushSubscription removes a push subscription.
func (h *NotificationHandler) DeletePushSubscription(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	var body struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing endpoint"})
		return
	}
	_ = h.callRepo.DeletePushSubscription(userID, body.Endpoint)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// SendPush sends a web push notification to all subscriptions of a user (internal helper).
func (h *NotificationHandler) SendPushToUser(userID uuid.UUID, title, body, tag, url string) {
	if h.pushService == nil {
		return
	}
	subs, err := h.callRepo.GetPushSubscriptions(userID)
	if err != nil || len(subs) == 0 {
		return
	}
	if url == "" {
		url = "/"
	}
	p := push.Payload{Title: title, Body: body, Icon: "/favicon.svg", Tag: tag, URL: url}
	pushSubs := make([]push.Subscription, len(subs))
	for i, s := range subs {
		pushSubs[i] = push.Subscription{Endpoint: s.Endpoint, P256DH: s.P256DH, Auth: s.Auth}
	}
	h.pushService.SendToMany(pushSubs, p)
}

// NotifyUser persists an in-app notification, broadcasts over socket, and sends web push.
func (h *NotificationHandler) NotifyUser(
	userID uuid.UUID,
	nType, title, body, pushURL, pushTag string,
	data map[string]interface{},
) {
	dataJSON, _ := json.Marshal(data)
	n := &models.Notification{
		ID:     uuid.New(),
		UserID: userID,
		Type:   nType,
		Title:  title,
		Body:   body,
		Data:   string(dataJSON),
	}
	_ = h.callRepo.CreateNotification(n)
	socket.BroadcastToUsers([]uuid.UUID{userID}, socket.EventNotificationNew, n)
	h.SendPushToUser(userID, title, body, pushTag, pushURL)
}
