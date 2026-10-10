package handlers

import (
	"errors"
	"net/http"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MyWallet returns the signed-in driver's balance, ledger, top-up requests and
// the stand's payment instructions.
func (h *DriverHandler) MyWallet(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}
	userID := c.MustGet("userID").(uuid.UUID)
	if err := h.driverRepo.EnsureProfileAndWallet(orgID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load wallet"})
		return
	}
	wallet, err := h.driverRepo.GetWallet(orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load wallet"})
		return
	}
	ledger, _ := h.driverRepo.ListLedger(orgID, userID, 50)
	requests, _ := h.driverRepo.ListTopupRequests(orgID, &userID, "", 20)
	org, _ := h.orgRepo.GetByID(orgID)

	resp := gin.H{
		"wallet":         wallet,
		"ledger":         ledger,
		"topupRequests":  requests,
		"commissionRate": 10,
		"commissionMin":  200,
		"creditFloorMmk": -5000,
		"paymentInfo":    "",
		"canReceiveJobs": true,
		"topupMethods":   []string{"kbzpay", "wavepay", "ayapay", "cbpay", "bank", "cash"},
	}
	if org != nil {
		resp["creditFloorMmk"] = org.DriverCreditFloorMMK
		resp["paymentInfo"] = org.WalletPaymentInfo
		resp["canReceiveJobs"] = wallet.BalanceMMK >= org.DriverCreditFloorMMK
	}
	c.JSON(http.StatusOK, resp)
}

func (h *DriverHandler) CreateTopupRequest(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || role != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Driver access required"})
		return
	}
	var req models.CreateTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Method = strings.ToLower(strings.TrimSpace(req.Method))
	req.Reference = strings.TrimSpace(req.Reference)
	req.Note = strings.TrimSpace(req.Note)
	if !models.TopupMethods[req.Method] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported payment method"})
		return
	}
	if req.Method != "cash" && len(req.Reference) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction ID is required for mobile payments"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	pending, _ := h.driverRepo.ListTopupRequests(orgID, &userID, "pending", 10)
	if len(pending) >= 3 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "You already have 3 pending top-ups. Wait for the stand to review them."})
		return
	}

	created, err := h.driverRepo.CreateTopupRequest(orgID, userID, req)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateTopupReference) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit top-up"})
		return
	}
	h.notifyManagers(orgID, "wallet.topup_requested", created)
	c.JSON(http.StatusCreated, created)
}

func (h *DriverHandler) ListTopupRequests(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	status := c.Query("status")
	switch status {
	case "", "pending", "approved", "rejected":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}
	rows, err := h.driverRepo.ListTopupRequests(orgID, nil, status, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list top-ups"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *DriverHandler) ApproveTopupRequest(c *gin.Context) {
	h.reviewTopup(c, true)
}

func (h *DriverHandler) RejectTopupRequest(c *gin.Context) {
	h.reviewTopup(c, false)
}

func (h *DriverHandler) reviewTopup(c *gin.Context, approve bool) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}
	var req models.ReviewTopupRequest
	_ = c.ShouldBindJSON(&req)

	status := "rejected"
	if approve {
		status = "approved"
	}
	reviewerID := c.MustGet("userID").(uuid.UUID)
	claimed, err := h.driverRepo.ClaimTopupRequest(orgID, id, reviewerID, status, strings.TrimSpace(req.Note))
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	if approve {
		reason := "topup:" + claimed.ID.String()
		if claimed.Reference != "" {
			reason += " " + claimed.Method + " " + claimed.Reference
		}
		if _, err := h.driverRepo.AdjustWallet(orgID, claimed.UserID, reviewerID, claimed.AmountMMK, "credit", reason); err != nil {
			h.driverRepo.RevertTopupClaim(orgID, claimed.ID)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to credit wallet"})
			return
		}
	}

	socket.BroadcastToUsers([]uuid.UUID{claimed.UserID}, "wallet.topup_reviewed", claimed)
	h.notifyManagers(orgID, "wallet.topup_reviewed", claimed)
	c.JSON(http.StatusOK, claimed)
}

func (h *DriverHandler) notifyManagers(orgID uuid.UUID, event string, payload interface{}) {
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		return
	}
	ids := make([]uuid.UUID, 0)
	for _, m := range members {
		if m.Role == "owner" || m.Role == "admin" {
			ids = append(ids, m.UserID)
		}
	}
	if len(ids) > 0 {
		socket.BroadcastToUsers(ids, event, payload)
	}
}
