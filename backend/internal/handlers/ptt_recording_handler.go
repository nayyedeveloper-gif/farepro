package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"
	"telegram-clone/internal/transcription"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PTTRecordingHandler struct {
	recordingRepo *repository.PTTRecordingRepository
	channelRepo   *repository.ChannelRepository
	userRepo      *repository.UserRepository
	uploadsDir    string
	openAIKey     string
}

func NewPTTRecordingHandler(
	recordingRepo *repository.PTTRecordingRepository,
	channelRepo *repository.ChannelRepository,
	userRepo *repository.UserRepository,
	uploadsDir string,
) *PTTRecordingHandler {
	return &PTTRecordingHandler{
		recordingRepo: recordingRepo,
		channelRepo:   channelRepo,
		userRepo:      userRepo,
		uploadsDir:    uploadsDir,
		openAIKey:     os.Getenv("OPENAI_API_KEY"),
	}
}

func (h *PTTRecordingHandler) resolveUploadPath(fileURL string) string {
	name := fileURL
	if i := strings.LastIndex(fileURL, "/"); i >= 0 {
		name = fileURL[i+1:]
	}
	return filepath.Join(h.uploadsDir, name)
}

func (h *PTTRecordingHandler) SaveRecording(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if _, err := h.channelRepo.GetMemberRole(channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a channel member"})
		return
	}

	var req models.SavePTTRecordingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rec := &models.PTTRecording{
		ID:         uuid.New(),
		ChannelID:  channelID,
		UserID:     userID,
		FileURL:    req.FileURL,
		DurationMs: req.DurationMs,
	}
	if err := h.recordingRepo.Create(rec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recording"})
		return
	}

	if u, err := h.userRepo.GetByID(userID); err == nil {
		rec.User = u
	}

	members, _ := h.channelRepo.GetChannelMembers(channelID)
	memberIDs := make([]uuid.UUID, len(members))
	for i, m := range members {
		memberIDs[i] = m.ID
	}
	socket.BroadcastToUsers(memberIDs, "ptt.history", rec)

	c.JSON(http.StatusCreated, rec)
}

func (h *PTTRecordingHandler) GetHistory(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	if _, err := h.channelRepo.GetMemberRole(channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a channel member"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	recordings, err := h.recordingRepo.ListByChannel(channelID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get history"})
		return
	}

	c.JSON(http.StatusOK, recordings)
}

// RequestTranscription runs Whisper when OPENAI_API_KEY is configured.
func (h *PTTRecordingHandler) RequestTranscription(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	channelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}
	recordingID, err := uuid.Parse(c.Param("recordingId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid recording ID"})
		return
	}

	if _, err := h.channelRepo.GetMemberRole(channelID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a channel member"})
		return
	}

	rec, err := h.recordingRepo.GetByID(recordingID)
	if err != nil || rec.ChannelID != channelID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recording not found"})
		return
	}

	if rec.TranscriptionStatus == "done" && rec.TranscriptionText != "" {
		c.JSON(http.StatusOK, rec)
		return
	}

	if h.openAIKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "AI transcription is not configured",
			"message": "Set OPENAI_API_KEY on the server to enable Whisper transcription",
			"status":  "unavailable",
		})
		return
	}

	_ = h.recordingRepo.UpdateTranscription(recordingID, "", "processing")

	filePath := h.resolveUploadPath(rec.FileURL)
	text, err := transcription.TranscribeAudio(h.openAIKey, filePath)
	if err != nil {
		_ = h.recordingRepo.UpdateTranscription(recordingID, "", "failed")
		c.JSON(http.StatusBadGateway, gin.H{"error": "Transcription failed", "message": err.Error()})
		return
	}

	if err := h.recordingRepo.UpdateTranscription(recordingID, text, "done"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save transcription"})
		return
	}

	rec.TranscriptionText = text
	rec.TranscriptionStatus = "done"
	c.JSON(http.StatusOK, rec)
}
