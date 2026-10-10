package handlers

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"telegram-clone/internal/auth"
	"telegram-clone/internal/middleware"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SystemInfo is what the platform health page reports about this server.
type SystemInfo struct {
	LiveKitURL  string
	DemoEnabled bool
	StartedAt   time.Time
}

func (h *PlatformHandler) WithSystem(info SystemInfo) *PlatformHandler {
	h.system = info
	return h
}

// audit records a super-admin action. Failures are logged, never surfaced:
// the action itself already succeeded.
func (h *PlatformHandler) audit(c *gin.Context, action, targetType, targetID, summary string, meta map[string]interface{}) {
	if h.platformRepo == nil {
		return
	}
	actorID, _ := c.Get("userID")
	actor, _ := actorID.(uuid.UUID)
	err := h.platformRepo.InsertAudit(repository.AuditEntry{
		ActorID:    actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Summary:    summary,
		Metadata:   meta,
		IP:         c.ClientIP(),
	})
	if err != nil {
		log.Printf("platform audit: failed to record %s: %v", action, err)
	}
}

func (h *PlatformHandler) ListUsers(c *gin.Context) {
	offset, _ := strconv.Atoi(c.Query("offset"))
	rows, total, err := h.platformRepo.ListUsers(repository.PlatformUserFilter{
		Query:  c.Query("q"),
		Status: c.Query("status"),
		Limit:  queryLimit(c, 50),
		Offset: offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list users"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": rows, "total": total})
}

func (h *PlatformHandler) loadTargetUser(c *gin.Context) (*repository.PlatformUserBrief, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return nil, false
	}
	u, err := h.platformRepo.GetUserBrief(id)
	if errors.Is(err, repository.ErrUserNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user"})
		return nil, false
	}
	return u, true
}

func (h *PlatformHandler) SuspendUser(c *gin.Context) {
	target, ok := h.loadTargetUser(c)
	if !ok {
		return
	}
	var req struct {
		Reason string `json:"reason" binding:"required,min=3,max=300"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A reason (3–300 characters) is required"})
		return
	}
	if target.ID == c.MustGet("userID").(uuid.UUID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot suspend your own account"})
		return
	}
	if target.IsPlatformAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Revoke platform admin access before suspending this account"})
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if err := h.platformRepo.SetUserBan(target.ID, true, reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to suspend user"})
		return
	}
	middleware.InvalidateBan(target.ID)
	h.audit(c, "user.suspend", "user", target.ID.String(),
		fmt.Sprintf("Suspended %s (%s)", target.Username, target.Phone),
		map[string]interface{}{"reason": reason})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *PlatformHandler) RestoreUser(c *gin.Context) {
	target, ok := h.loadTargetUser(c)
	if !ok {
		return
	}
	if err := h.platformRepo.SetUserBan(target.ID, false, ""); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore user"})
		return
	}
	middleware.InvalidateBan(target.ID)
	h.audit(c, "user.restore", "user", target.ID.String(),
		fmt.Sprintf("Restored %s (%s)", target.Username, target.Phone), nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

const tempPasswordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

func generateTempPassword(n int) (string, error) {
	var b strings.Builder
	max := big.NewInt(int64(len(tempPasswordAlphabet)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b.WriteByte(tempPasswordAlphabet[idx.Int64()])
	}
	return b.String(), nil
}

func (h *PlatformHandler) ResetUserPassword(c *gin.Context) {
	target, ok := h.loadTargetUser(c)
	if !ok {
		return
	}
	self := target.ID == c.MustGet("userID").(uuid.UUID)
	if target.IsPlatformAdmin && !self {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Another platform admin's password can't be reset here. Revoke their admin access first."})
		return
	}
	password, err := generateTempPassword(12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}
	if err := h.userRepo.SetPasswordHash(target.ID, hash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}
	h.audit(c, "user.reset_password", "user", target.ID.String(),
		fmt.Sprintf("Reset password for %s (%s)", target.Username, target.Phone), nil)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"temporaryPassword": password})
}

func (h *PlatformHandler) ListAudit(c *gin.Context) {
	rows, err := h.platformRepo.ListAudit(repository.PlatformAuditFilter{
		Action:     c.Query("action"),
		TargetType: c.Query("targetType"),
		TargetID:   c.Query("targetId"),
		Query:      c.Query("q"),
		Limit:      queryLimit(c, 200),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load audit log"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

type healthCheck struct {
	Name      string `json:"name"`
	Status    string `json:"status"` // ok | degraded | down
	LatencyMs int64  `json:"latencyMs"`
	Detail    string `json:"detail,omitempty"`
}

func checkFromLatency(name string, d time.Duration, err error, slow time.Duration) healthCheck {
	hc := healthCheck{Name: name, Status: "ok", LatencyMs: d.Milliseconds()}
	switch {
	case err != nil:
		hc.Status = "down"
		hc.Detail = err.Error()
	case d > slow:
		hc.Status = "degraded"
		hc.Detail = "Responding slowly"
	}
	return hc
}

var healthClient = &http.Client{Timeout: 3 * time.Second}

func livekitHTTPURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.Replace(u, "wss://", "https://", 1)
	u = strings.Replace(u, "ws://", "http://", 1)
	return strings.TrimRight(u, "/")
}

func checkLiveKit(raw string) healthCheck {
	if raw == "" {
		return healthCheck{Name: "Calls (LiveKit)", Status: "down", Detail: "LIVEKIT_URL is not configured"}
	}
	start := time.Now()
	resp, err := healthClient.Get(livekitHTTPURL(raw) + "/")
	if err == nil {
		resp.Body.Close()
		if resp.StatusCode >= 500 {
			err = fmt.Errorf("status %d", resp.StatusCode)
		}
	}
	return checkFromLatency("Calls (LiveKit)", time.Since(start), err, 800*time.Millisecond)
}

func (h *PlatformHandler) SystemHealth(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	dbLatency, dbErr := h.platformRepo.PingDB(ctx)
	checks := []healthCheck{checkFromLatency("Database", dbLatency, dbErr, 200*time.Millisecond)}

	lk := make(chan healthCheck, 1)
	go func() { lk <- checkLiveKit(h.system.LiveKitURL) }()
	osrm := make(chan healthCheck, 1)
	go func() {
		d, err := services.CheckRouting()
		osrm <- checkFromLatency("Routing (OSRM)", d, err, 1500*time.Millisecond)
	}()
	checks = append(checks, <-lk, <-osrm)

	var stats *repository.PlatformDBStats
	if dbErr == nil {
		stats, _ = h.platformRepo.DBStats()
	}

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	deployedAt := ""
	if exe, err := os.Executable(); err == nil {
		if fi, err := os.Stat(exe); err == nil {
			deployedAt = fi.ModTime().UTC().Format(time.RFC3339)
		}
	}

	overall := "ok"
	for _, ch := range checks {
		if ch.Status == "down" {
			overall = "down"
			break
		}
		if ch.Status == "degraded" {
			overall = "degraded"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": overall,
		"checks": checks,
		"stats":  stats,
		"runtime": gin.H{
			"startedAt":   h.system.StartedAt.UTC().Format(time.RFC3339),
			"uptimeSec":   int64(time.Since(h.system.StartedAt).Seconds()),
			"deployedAt":  deployedAt,
			"goVersion":   runtime.Version(),
			"goroutines":  runtime.NumGoroutine(),
			"heapMb":      mem.HeapAlloc / (1024 * 1024),
			"demoEnabled": h.system.DemoEnabled,
		},
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
	})
}
