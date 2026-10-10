package socket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	EventMessageNew      = "message.new"
	EventTypingStart     = "typing.start"
	EventTypingStop      = "typing.stop"
	EventCallIncoming    = "call.incoming"
	EventCallAccepted    = "call.accepted"
	EventCallRejected    = "call.rejected"
	EventCallEnded       = "call.ended"
	EventCallBusy        = "call.busy"
	EventCallMissed      = "call.missed"
	EventCallStatus      = "call.status"
	EventPresenceUpdate  = "presence.update"
	EventSessionUpdate   = "session.update"
	EventNotificationNew = "notification.new"
	EventStoryNew        = "story.new"
	EventStoryDeleted    = "story.deleted"
	EventPTTStart        = "ptt.start"
	EventPTTStop         = "ptt.stop"
	EventPTTAudio        = "ptt.audio"
	EventPTTDenied       = "ptt.denied"
	EventPTTMemberJoined = "ptt.member_joined"
	EventPTTMemberLeft   = "ptt.member_left"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	ID          uuid.UUID
	Conn        *websocket.Conn
	Send        chan []byte
	UserID      uuid.UUID
	DeviceID    string
	DeviceName  string
	Platform    string
	App         string
	ConnectedAt time.Time
}

type DeviceInfo struct {
	ClientID    string `json:"clientId"`
	DeviceID    string `json:"deviceId"`
	DeviceName  string `json:"deviceName"`
	Platform    string `json:"platform"`
	App         string `json:"app"`
	ConnectedAt string `json:"connectedAt"`
}

type Hub struct {
	clients    map[uuid.UUID]*Client
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type Envelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ParticipantLookup func(conversationID uuid.UUID) ([]uuid.UUID, error)
type ChannelMemberLookup func(channelID uuid.UUID) ([]uuid.UUID, error)
type UserChannelsLookup func(userID uuid.UUID) ([]uuid.UUID, error)

var (
	hub = &Hub{
		clients:    make(map[uuid.UUID]*Client),
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
	}
	participantLookup  ParticipantLookup
	onClientConnect    func(userID uuid.UUID, sessionCount int)
	onClientDisconnect func(userID uuid.UUID, sessionCount int)

	sessionMu    sync.RWMutex
	userSessions = make(map[uuid.UUID]int)
	callMu       sync.RWMutex
	usersInCall  = make(map[uuid.UUID]uuid.UUID)

	pttMu          sync.Mutex
	pttLocks       = make(map[uuid.UUID]uuid.UUID) // channelID -> userID
	channelMembers ChannelMemberLookup
	userChannels   UserChannelsLookup
)

func SetParticipantLookup(fn ParticipantLookup) {
	participantLookup = fn
}

func SetPresenceHandlers(onConnect, onDisconnect func(userID uuid.UUID, sessionCount int)) {
	onClientConnect = onConnect
	onClientDisconnect = onDisconnect
}

func incrementSession(userID uuid.UUID) int {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	userSessions[userID]++
	return userSessions[userID]
}

func decrementSession(userID uuid.UUID) int {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	userSessions[userID]--
	if userSessions[userID] <= 0 {
		delete(userSessions, userID)
		return 0
	}
	return userSessions[userID]
}

func GetUserSessionCount(userID uuid.UUID) int {
	sessionMu.RLock()
	defer sessionMu.RUnlock()
	return userSessions[userID]
}

func GetUserDevices(userID uuid.UUID) []DeviceInfo {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	var devices []DeviceInfo
	for _, client := range hub.clients {
		if client.UserID == userID {
			devices = append(devices, DeviceInfo{
				ClientID:    client.ID.String(),
				DeviceID:    client.DeviceID,
				DeviceName:  client.DeviceName,
				Platform:    client.Platform,
				App:         client.App,
				ConnectedAt: client.ConnectedAt.UTC().Format(time.RFC3339),
			})
		}
	}
	return devices
}

func DisconnectClient(userID, clientID uuid.UUID) bool {
	hub.mu.RLock()
	var target *Client
	for _, client := range hub.clients {
		if client.UserID == userID && client.ID == clientID {
			target = client
			break
		}
	}
	hub.mu.RUnlock()
	if target == nil {
		return false
	}
	target.Conn.Close()
	return true
}

func DisconnectOtherClients(userID uuid.UUID, keepDeviceID string) int {
	hub.mu.RLock()
	var toClose []*Client
	for _, client := range hub.clients {
		if client.UserID == userID && client.DeviceID != keepDeviceID {
			toClose = append(toClose, client)
		}
	}
	hub.mu.RUnlock()
	for _, client := range toClose {
		client.Conn.Close()
	}
	return len(toClose)
}

func SetUserInCall(userID, callID uuid.UUID) {
	callMu.Lock()
	defer callMu.Unlock()
	usersInCall[userID] = callID
}

func ClearUserFromCall(userID uuid.UUID) {
	callMu.Lock()
	defer callMu.Unlock()
	delete(usersInCall, userID)
}

func ClearCallParticipants(userIDs []uuid.UUID) {
	callMu.Lock()
	defer callMu.Unlock()
	for _, id := range userIDs {
		delete(usersInCall, id)
	}
}

func IsUserInCall(userID uuid.UUID) bool {
	callMu.RLock()
	defer callMu.RUnlock()
	_, ok := usersInCall[userID]
	return ok
}

func GetUserActiveCallID(userID uuid.UUID) *uuid.UUID {
	callMu.RLock()
	defer callMu.RUnlock()
	callID, ok := usersInCall[userID]
	if !ok {
		return nil
	}
	return &callID
}

func GetUserCallID(userID uuid.UUID) (uuid.UUID, bool) {
	callMu.RLock()
	defer callMu.RUnlock()
	id, ok := usersInCall[userID]
	return id, ok
}

func notifySessionUpdate(userID uuid.UUID) {
	count := GetUserSessionCount(userID)
	BroadcastToUser(userID, mustMarshal(Envelope{
		Type: EventSessionUpdate,
		Data: mustJSON(map[string]interface{}{
			"sessionCount": count,
			"userId":       userID.String(),
		}),
	}))
}

func notifyPresenceUpdate(userID uuid.UUID, isOnline bool) {
	if userChannels == nil {
		return
	}
	channelIDs, err := userChannels(userID)
	if err != nil {
		return
	}
	payload := mustJSON(map[string]interface{}{
		"userId":   userID.String(),
		"isOnline": isOnline,
	})
	envelope := mustMarshal(Envelope{Type: EventPresenceUpdate, Data: payload})
	for _, chID := range channelIDs {
		if channelMembers == nil {
			continue
		}
		memberIDs, err := channelMembers(chID)
		if err != nil {
			continue
		}
		for _, memberID := range memberIDs {
			if memberID != userID {
				BroadcastToUser(memberID, envelope)
			}
		}
	}
}

func mustJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			count := incrementSession(client.UserID)
			log.Printf("Client connected: user=%s sessions=%d", client.UserID, count)
			notifySessionUpdate(client.UserID)
			notifyPresenceUpdate(client.UserID, true)
			if onClientConnect != nil {
				onClientConnect(client.UserID, count)
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()

			// Clean up any PTT locks held by this user
			pttMu.Lock()
			for chID, uid := range pttLocks {
				if uid == client.UserID {
					delete(pttLocks, chID)
				}
			}
			pttMu.Unlock()

			count := decrementSession(client.UserID)
			log.Printf("Client disconnected: user=%s sessions=%d", client.UserID, count)
			notifySessionUpdate(client.UserID)
			if count == 0 {
				notifyPresenceUpdate(client.UserID, false)
			}
			if onClientDisconnect != nil {
				onClientDisconnect(client.UserID, count)
			}
		}
	}
}

func HandleWebSocket(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	deviceName := c.Query("deviceName")
	if deviceName == "" {
		deviceName = "Web Browser"
	}
	platform := c.Query("platform")
	if platform == "" {
		platform = "Web"
	}
	app := c.Query("app")
	if app == "" {
		app = "Telegram Web"
	}

	client := &Client{
		ID:          uuid.New(),
		Conn:        conn,
		Send:        make(chan []byte, 256),
		UserID:      userID,
		DeviceID:    c.Query("deviceId"),
		DeviceName:  deviceName,
		Platform:    platform,
		App:         app,
		ConnectedAt: time.Now(),
	}

	hub.register <- client

	// Send current session count on connect
	go func() {
		count := GetUserSessionCount(userID)
		client.Send <- mustMarshal(Envelope{
			Type: EventSessionUpdate,
			Data: mustJSON(map[string]interface{}{
				"sessionCount": count,
				"userId":       userID.String(),
			}),
		})
	}()

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var envelope Envelope
		if err := json.Unmarshal(message, &envelope); err != nil {
			continue
		}

		switch envelope.Type {
		case EventTypingStart, EventTypingStop:
			c.handleTypingEvent(envelope)
		case EventPTTStart:
			c.handlePTTStart(envelope)
		case EventPTTStop:
			c.handlePTTStop(envelope)
		case EventPTTAudio:
			c.handlePTTAudio(envelope)
		}
	}
}

func (c *Client) handleTypingEvent(envelope Envelope) {
	if participantLookup == nil {
		return
	}

	var data struct {
		ConversationID string `json:"conversationId"`
		UserName       string `json:"userName"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return
	}

	conversationID, err := uuid.Parse(data.ConversationID)
	if err != nil {
		return
	}

	participantIDs, err := participantLookup(conversationID)
	if err != nil {
		return
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"conversationId": data.ConversationID,
		"userId":         c.UserID.String(),
		"userName":       data.UserName,
	})

	out, _ := json.Marshal(Envelope{Type: envelope.Type, Data: payload})
	for _, id := range participantIDs {
		if id != c.UserID {
			BroadcastToUser(id, out)
		}
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

func SetChannelMemberLookup(fn ChannelMemberLookup) {
	channelMembers = fn
}

func SetUserChannelsLookup(fn UserChannelsLookup) {
	userChannels = fn
}

func (c *Client) handlePTTStart(envelope Envelope) {
	var data struct {
		ChannelID string `json:"channelId"`
		UserName  string `json:"userName"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return
	}

	channelID, err := uuid.Parse(data.ChannelID)
	if err != nil {
		return
	}

	pttMu.Lock()
	if existing, ok := pttLocks[channelID]; ok && existing != c.UserID {
		pttMu.Unlock()
		c.Send <- mustMarshal(Envelope{
			Type: EventPTTDenied,
			Data: mustJSON(map[string]interface{}{
				"channelId": data.ChannelID,
				"reason":    "Channel is busy",
			}),
		})
		return
	}
	pttLocks[channelID] = c.UserID
	pttMu.Unlock()

	if channelMembers != nil {
		memberIDs, err := channelMembers(channelID)
		if err == nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"channelId": data.ChannelID,
				"userId":    c.UserID.String(),
				"userName":  data.UserName,
			})
			out, _ := json.Marshal(Envelope{Type: EventPTTStart, Data: payload})
			for _, id := range memberIDs {
				if id != c.UserID {
					BroadcastToUser(id, out)
				}
			}
		}
	}
}

func (c *Client) handlePTTStop(envelope Envelope) {
	var data struct {
		ChannelID string `json:"channelId"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return
	}

	channelID, err := uuid.Parse(data.ChannelID)
	if err != nil {
		return
	}

	pttMu.Lock()
	if current, ok := pttLocks[channelID]; ok && current == c.UserID {
		delete(pttLocks, channelID)
	}
	pttMu.Unlock()

	if channelMembers != nil {
		memberIDs, err := channelMembers(channelID)
		if err == nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"channelId": data.ChannelID,
				"userId":    c.UserID.String(),
			})
			out, _ := json.Marshal(Envelope{Type: EventPTTStop, Data: payload})
			for _, id := range memberIDs {
				if id != c.UserID {
					BroadcastToUser(id, out)
				}
			}
		}
	}
}

func (c *Client) handlePTTAudio(envelope Envelope) {
	var data struct {
		ChannelID string `json:"channelId"`
		Audio     string `json:"audio"`
		Format    string `json:"format"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return
	}

	channelID, err := uuid.Parse(data.ChannelID)
	if err != nil {
		return
	}

	pttMu.Lock()
	if current, ok := pttLocks[channelID]; !ok || current != c.UserID {
		pttMu.Unlock()
		return
	}
	pttMu.Unlock()

	if channelMembers != nil {
		memberIDs, err := channelMembers(channelID)
		if err == nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"channelId": data.ChannelID,
				"userId":    c.UserID.String(),
				"audio":     data.Audio,
				"format":    data.Format,
			})
			out, _ := json.Marshal(Envelope{Type: EventPTTAudio, Data: payload})
			for _, id := range memberIDs {
				if id != c.UserID {
					BroadcastToUser(id, out)
				}
			}
		}
	}
}

func BroadcastToUser(userID uuid.UUID, message []byte) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	for _, client := range hub.clients {
		if client.UserID == userID {
			select {
			case client.Send <- message:
			default:
			}
		}
	}
}

func BroadcastToUsers(userIDs []uuid.UUID, eventType string, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		return
	}
	envelope, err := json.Marshal(Envelope{Type: eventType, Data: payload})
	if err != nil {
		return
	}
	for _, userID := range userIDs {
		BroadcastToUser(userID, envelope)
	}
}

func SendEvent(userID uuid.UUID, eventType string, data interface{}) {
	BroadcastToUsers([]uuid.UUID{userID}, eventType, data)
}

func BroadcastToAll(eventType string, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		return
	}
	envelope, err := json.Marshal(Envelope{Type: eventType, Data: payload})
	if err != nil {
		return
	}
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	for _, client := range hub.clients {
		select {
		case client.Send <- envelope:
		default:
		}
	}
}

func BroadcastToChannel(channelID uuid.UUID, eventType string, data interface{}) {
	if channelMembers == nil {
		return
	}
	memberIDs, err := channelMembers(channelID)
	if err != nil {
		return
	}
	BroadcastToUsers(memberIDs, eventType, data)
}

func StartHub() {
	go hub.Run()
}
