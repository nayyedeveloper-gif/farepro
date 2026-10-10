package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"telegram-clone/internal/config"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
)

type CallHandler struct {
	messageRepo *repository.MessageRepository
	userRepo    *repository.UserRepository
	callRepo    *repository.CallRepository
	liveKit     config.LiveKitConfig
}

var callStore = struct {
	sync.RWMutex
	calls map[uuid.UUID]*models.Call
}{
	calls: make(map[uuid.UUID]*models.Call),
}

func NewCallHandler(
	messageRepo *repository.MessageRepository,
	userRepo *repository.UserRepository,
	callRepo *repository.CallRepository,
	liveKit config.LiveKitConfig,
) *CallHandler {
	return &CallHandler{
		messageRepo: messageRepo,
		userRepo:    userRepo,
		callRepo:    callRepo,
		liveKit:     liveKit,
	}
}

func (h *CallHandler) generateToken(roomName, identity string) (string, error) {
	at := auth.NewAccessToken(h.liveKit.APIKey, h.liveKit.APISecret)
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   boolPtr(true),
		CanSubscribe: boolPtr(true),
	}
	at.SetVideoGrant(grant).
		SetIdentity(identity).
		SetValidFor(24 * time.Hour)
	return at.ToJWT()
}

func boolPtr(v bool) *bool { return &v }

func (h *CallHandler) GetConversationCalls(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}
	items, err := h.callRepo.GetConversationCalls(conversationID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get call history"})
		return
	}
	if items == nil {
		items = []models.CallHistoryItem{}
	}
	c.JSON(http.StatusOK, items)
}

func (h *CallHandler) storeActiveCall(call *models.Call) {
	callStore.Lock()
	callStore.calls[call.ID] = call
	callStore.Unlock()
}

func (h *CallHandler) getActiveCall(callID uuid.UUID) (*models.Call, bool) {
	callStore.RLock()
	defer callStore.RUnlock()
	call, ok := callStore.calls[callID]
	return call, ok
}

func (h *CallHandler) removeActiveCall(callID uuid.UUID) {
	callStore.Lock()
	delete(callStore.calls, callID)
	callStore.Unlock()
}

func (h *CallHandler) sendNotification(userID uuid.UUID, nType, title, body string, data map[string]interface{}) {
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
}

func (h *CallHandler) GetToken(c *gin.Context) {
	var req models.CallTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)
	identity := req.Identity
	if identity == "" {
		identity = userID.String()
	}
	token, err := h.generateToken(req.RoomName, identity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token": token, "url": h.liveKit.URL, "roomName": req.RoomName, "identity": identity,
	})
}

func (h *CallHandler) GetHistory(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	filter := c.Query("filter")
	history, err := h.callRepo.GetUserCallHistory(userID, filter, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get call history"})
		return
	}
	if history == nil {
		history = []models.CallHistoryItem{}
	}
	c.JSON(http.StatusOK, history)
}

func (h *CallHandler) GetSessions(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	count := socket.GetUserSessionCount(userID)
	isInCall := socket.IsUserInCall(userID)

	var activeCall *models.Call
	var activeCallParticipants []models.User
	var initiator *models.User

	if isInCall {
		callID := socket.GetUserActiveCallID(userID)
		if callID != nil {
			call, ok := h.getActiveCall(*callID)
			if !ok {
				call, _ = h.callRepo.GetCallByID(*callID)
			}
			if call != nil {
				activeCall = call
				participants, _ := h.messageRepo.GetConversationParticipants(call.ConversationID)
				activeCallParticipants = participants
				initiator, _ = h.userRepo.GetByID(call.InitiatedBy)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"sessionCount": count,
		"isInCall":     isInCall,
		"activeCall":   activeCall,
		"participants": activeCallParticipants,
		"initiator":    initiator,
	})
}

func (h *CallHandler) Dial(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	var req models.DialCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetUser, err := h.userRepo.GetByPhone(req.Phone)
	if err != nil || targetUser == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found for this number"})
		return
	}

	if targetUser.ID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot call yourself"})
		return
	}

	conv, err := h.messageRepo.GetOrCreatePrivateConversation(userID, targetUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	h.initiateCallInternal(c, userID, conv.ID, req.CallType)
}

func (h *CallHandler) InitiateCall(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	var req models.InitiateCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	conversationID, err := uuid.Parse(req.ConversationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}
	h.initiateCallInternal(c, userID, conversationID, req.CallType)
}

func (h *CallHandler) initiateCallInternal(c *gin.Context, userID, conversationID uuid.UUID, callType string) {
	participants, err := h.messageRepo.GetConversationParticipants(conversationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get participants"})
		return
	}

	// Check if caller is already in a call
	if socket.IsUserInCall(userID) {
		c.JSON(http.StatusConflict, gin.H{"error": "You are already in a call", "status": "busy"})
		return
	}

	// Check if any callee is busy
	for _, p := range participants {
		if p.ID != userID && socket.IsUserInCall(p.ID) {
			call := &models.Call{
				ID:              uuid.New(),
				ConversationID:  conversationID,
				InitiatedBy:     userID,
				CallType:        callType,
				LiveKitRoomName: "call-" + uuid.New().String(),
				Status:          "busy",
				CallResult:      "busy",
				StartedAt:       time.Now(),
			}
			now := time.Now()
			call.EndedAt = &now
			_ = h.callRepo.CreateCall(call)

			name := p.FirstName
			if name == "" {
				name = p.Username
			}
			socket.BroadcastToUsers([]uuid.UUID{userID}, socket.EventCallBusy, gin.H{
				"call": call, "userId": p.ID, "userName": name, "status": "busy",
			})
			h.sendNotification(userID, "call.busy", "Line busy", name+" is on another call", map[string]interface{}{
				"callId": call.ID, "userId": p.ID.String(),
			})
			c.JSON(http.StatusConflict, gin.H{
				"error": "User is busy", "status": "busy", "call": call, "busyUser": p,
			})
			return
		}
	}

	call := &models.Call{
		ID:              uuid.New(),
		ConversationID:  conversationID,
		InitiatedBy:     userID,
		CallType:        callType,
		LiveKitRoomName: "call-" + uuid.New().String(),
		Status:          "ringing",
		CallResult:      "ringing",
		StartedAt:       time.Now(),
	}

	if err := h.callRepo.CreateCall(call); err != nil {
		log.Printf("Failed to persist call: %v", err)
	}

	h.storeActiveCall(call)
	socket.SetUserInCall(userID, call.ID)

	initiator, _ := h.userRepo.GetByID(userID)
	callLabel := "Voice call"
	if callType == "video" {
		callLabel = "Video call"
	}

	for _, p := range participants {
		if p.ID != userID {
			socket.BroadcastToUsers([]uuid.UUID{p.ID}, socket.EventCallIncoming, gin.H{
				"call": call, "initiator": initiator, "roomName": call.LiveKitRoomName, "livekitUrl": h.liveKit.URL,
			})
			callerName := initiator.FirstName
			if callerName == "" {
				callerName = initiator.Username
			}
			h.sendNotification(p.ID, "call.incoming", "Incoming "+callLabel, callerName+" is calling you", map[string]interface{}{
				"callId": call.ID.String(), "callType": callType,
			})
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"call": call, "roomName": call.LiveKitRoomName, "livekitUrl": h.liveKit.URL,
		"initiator": initiator, "participants": participants,
	})
}

func (h *CallHandler) JoinCall(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	callID, err := uuid.Parse(c.Param("callId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid call ID"})
		return
	}

	callStore.Lock()
	call, ok := callStore.calls[callID]
	if ok {
		call.Status = "active"
		call.CallResult = "answered"
	}
	callStore.Unlock()

	if !ok {
		call, err = h.callRepo.GetCallByID(callID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
			return
		}
	}

	_ = h.callRepo.UpdateCall(&models.Call{
		ID: callID, Status: "active", CallResult: "answered", EndedAt: nil,
	})
	_ = h.callRepo.AddParticipant(callID, userID, "joined")
	socket.SetUserInCall(userID, callID)

	participants, _ := h.messageRepo.GetConversationParticipants(call.ConversationID)
	var participantIDs []uuid.UUID
	for _, p := range participants {
		participantIDs = append(participantIDs, p.ID)
	}

	socket.BroadcastToUsers(participantIDs, socket.EventCallAccepted, gin.H{
		"callId": callID, "userId": userID, "roomName": call.LiveKitRoomName, "status": "active",
	})
	socket.BroadcastToUsers(participantIDs, socket.EventCallStatus, gin.H{
		"callId": callID, "userId": userID, "status": "active",
	})

	c.JSON(http.StatusOK, gin.H{
		"call": call, "roomName": call.LiveKitRoomName, "livekitUrl": h.liveKit.URL, "status": "joined",
	})
}

func (h *CallHandler) LeaveCall(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	callID, err := uuid.Parse(c.Param("callId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid call ID"})
		return
	}
	socket.ClearUserFromCall(userID)
	c.JSON(http.StatusOK, gin.H{"callId": callID, "userId": userID, "status": "left"})
}

func (h *CallHandler) EndCall(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	callID, err := uuid.Parse(c.Param("callId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid call ID"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	reason := req.Reason
	if reason == "" {
		reason = "ended"
	}

	call, ok := h.getActiveCall(callID)
	if !ok {
		call, _ = h.callRepo.GetCallByID(callID)
	}

	now := time.Now()
	result := "ended"
	status := "ended"

	switch reason {
	case "rejected":
		result = "rejected"
		status = "rejected"
	case "missed":
		result = "missed"
		status = "missed"
	case "cancelled":
		result = "cancelled"
		status = "ended"
	}

	if call != nil && call.Status == "ringing" && reason == "ended" {
		if call.InitiatedBy == userID {
			result = "cancelled"
		} else {
			result = "rejected"
			status = "rejected"
		}
	}

	if call != nil {
		call.Status = status
		call.CallResult = result
		call.EndedAt = &now
		_ = h.callRepo.UpdateCall(call)

		participants, _ := h.messageRepo.GetConversationParticipants(call.ConversationID)
		var participantIDs []uuid.UUID
		for _, p := range participants {
			participantIDs = append(participantIDs, p.ID)
			socket.ClearUserFromCall(p.ID)
		}

		eventType := socket.EventCallEnded
		if result == "rejected" {
			eventType = socket.EventCallRejected
		} else if result == "missed" {
			eventType = socket.EventCallMissed
		}

		payload := gin.H{"callId": callID, "userId": userID, "status": status, "result": result, "call": call}
		socket.BroadcastToUsers(participantIDs, eventType, payload)

		initiator, _ := h.userRepo.GetByID(call.InitiatedBy)
		for _, p := range participants {
			if p.ID == userID {
				continue
			}
			if result == "missed" || result == "rejected" {
				h.sendNotification(p.ID, "call.missed", "Missed call",
					initiator.FirstName+" tried to call you", map[string]interface{}{"callId": callID.String()})
			}
		}
	}

	h.removeActiveCall(callID)
	socket.ClearUserFromCall(userID)

	c.JSON(http.StatusOK, gin.H{"callId": callID, "status": status, "result": result})
}
