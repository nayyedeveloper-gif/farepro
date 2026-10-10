package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var subdomainPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

type PlatformHandler struct {
	orgRepo      *repository.OrganizationRepository
	userRepo     *repository.UserRepository
	platformRepo *repository.PlatformRepository
	driverRepo   *repository.DriverRepository
	orgHandler   *OrganizationHandler
	system       SystemInfo
}

func NewPlatformHandler(orgRepo *repository.OrganizationRepository, userRepo *repository.UserRepository) *PlatformHandler {
	return &PlatformHandler{orgRepo: orgRepo, userRepo: userRepo}
}

func (h *PlatformHandler) WithConsole(platformRepo *repository.PlatformRepository, driverRepo *repository.DriverRepository, orgHandler *OrganizationHandler) *PlatformHandler {
	h.platformRepo = platformRepo
	h.driverRepo = driverRepo
	h.orgHandler = orgHandler
	return h
}

func optionalOrgID(c *gin.Context) (*uuid.UUID, bool) {
	raw := strings.TrimSpace(c.Query("orgId"))
	if raw == "" {
		return nil, true
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid orgId"})
		return nil, false
	}
	return &id, true
}

func queryLimit(c *gin.Context, def int) int {
	n, err := strconv.Atoi(c.Query("limit"))
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func (h *PlatformHandler) Stats(c *gin.Context) {
	stats, err := h.orgRepo.PlatformStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *PlatformHandler) Overview(c *gin.Context) {
	overview, err := h.platformRepo.Overview()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load overview"})
		return
	}
	series, err := h.platformRepo.DailySeries(14)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trend"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"overview": overview, "series": series})
}

func (h *PlatformHandler) ListOrgs(c *gin.Context) {
	orgs, err := h.orgRepo.ListPlatformOrgs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list organizations"})
		return
	}
	c.JSON(http.StatusOK, orgs)
}

func (h *PlatformHandler) CreateOrg(c *gin.Context) {
	var req models.PlatformCreateStandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Subdomain = strings.ToLower(strings.TrimSpace(req.Subdomain))
	if !subdomainPattern.MatchString(req.Subdomain) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subdomain may only contain lowercase letters, numbers and hyphens"})
		return
	}
	switch req.Plan {
	case "", "free", "pro", "enterprise":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan"})
		return
	}
	if req.Industry == "" {
		req.Industry = "transportation"
	}

	org, owner, channels, err := h.orgHandler.CreateStand(req.CreateOrganizationRequest, req.Plan, req.MaxDrivers)
	if err != nil {
		status := http.StatusInternalServerError
		if se, ok := err.(*StandError); ok {
			status = se.Status
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	owner.PasswordHash = ""
	h.audit(c, "stand.create", "stand", org.ID.String(),
		fmt.Sprintf("Created stand %s (%s)", org.Name, org.Subdomain),
		map[string]interface{}{"plan": org.Plan, "ownerPhone": owner.Phone})
	c.JSON(http.StatusCreated, gin.H{
		"organization": org,
		"owner": gin.H{
			"id":       owner.ID,
			"username": owner.Username,
			"phone":    owner.Phone,
		},
		"channels": channels,
	})
}

func (h *PlatformHandler) GetOrg(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid org ID"})
		return
	}
	org, err := h.orgRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stand not found"})
		return
	}
	members, err := h.platformRepo.ListMembers(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load members"})
		return
	}
	trips, err := h.platformRepo.ListTrips(&orgID, "", 25)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trips"})
		return
	}
	drivers, err := h.platformRepo.ListDrivers(&orgID, "", false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load drivers"})
		return
	}
	billing, err := h.orgRepo.ListBillingLedger(orgID, 25)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load billing"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"organization": org,
		"members":      members,
		"drivers":      drivers,
		"trips":        trips,
		"billing":      billing,
	})
}

func (h *PlatformHandler) UpdateOrg(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid org ID"})
		return
	}
	var req models.PlatformSetPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	org, err := h.orgRepo.SetPlatformOrg(orgID, req.Plan, req.MaxDrivers, req.IsActive)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	meta := map[string]interface{}{"plan": req.Plan}
	if req.MaxDrivers != nil {
		meta["maxDrivers"] = *req.MaxDrivers
	}
	if req.IsActive != nil {
		meta["isActive"] = *req.IsActive
	}
	h.audit(c, "stand.update", "stand", orgID.String(), fmt.Sprintf("Updated plan/status of %s", org.Name), meta)
	c.JSON(http.StatusOK, org)
}

func (h *PlatformHandler) TopupOrg(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid org ID"})
		return
	}
	var req models.PlatformTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	actorID := c.MustGet("userID").(uuid.UUID)
	org, err := h.orgRepo.TopupBilling(orgID, actorID, req.AmountMMK, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "stand.topup", "stand", orgID.String(),
		fmt.Sprintf("Stand credit %+d Ks for %s", req.AmountMMK, org.Name),
		map[string]interface{}{"amountMmk": req.AmountMMK, "reason": req.Reason})
	c.JSON(http.StatusOK, org)
}

func (h *PlatformHandler) OrgBillingLedger(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid org ID"})
		return
	}
	rows, err := h.orgRepo.ListBillingLedger(orgID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load ledger"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *PlatformHandler) ListDrivers(c *gin.Context) {
	orgID, ok := optionalOrgID(c)
	if !ok {
		return
	}
	rows, err := h.platformRepo.ListDrivers(orgID, c.Query("q"), c.Query("online") == "true")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list drivers"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *PlatformHandler) AdjustDriverWallet(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid org ID"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}
	var req models.PlatformTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.AmountMMK == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Amount must not be zero"})
		return
	}
	role, err := h.orgRepo.GetUserOrgRole(userID, orgID)
	if err != nil || role != "driver" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found in this stand"})
		return
	}
	entryType := "credit"
	if req.AmountMMK < 0 {
		entryType = "adjust"
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "FarePro admin adjustment"
	}
	actorID := c.MustGet("userID").(uuid.UUID)
	wallet, err := h.driverRepo.AdjustWallet(orgID, userID, actorID, req.AmountMMK, entryType, reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "driver.wallet_adjust", "user", userID.String(),
		fmt.Sprintf("Driver wallet %+d Ks", req.AmountMMK),
		map[string]interface{}{"amountMmk": req.AmountMMK, "reason": reason, "orgId": orgID.String()})
	c.JSON(http.StatusOK, wallet)
}

func (h *PlatformHandler) ListTrips(c *gin.Context) {
	orgID, ok := optionalOrgID(c)
	if !ok {
		return
	}
	rows, err := h.platformRepo.ListTrips(orgID, c.Query("status"), queryLimit(c, 150))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list trips"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *PlatformHandler) LiveMap(c *gin.Context) {
	orgID, ok := optionalOrgID(c)
	if !ok {
		return
	}
	drivers, err := h.platformRepo.ListDrivers(orgID, "", false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load drivers"})
		return
	}
	located := make([]repository.PlatformDriverRow, 0, len(drivers))
	for _, d := range drivers {
		if d.Lat != nil && d.Lng != nil {
			located = append(located, d)
		}
	}
	active, err := h.platformRepo.ListTrips(orgID, "active", 300)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trips"})
		return
	}
	open, err := h.platformRepo.ListTrips(orgID, "open", 300)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trips"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"drivers": located,
		"trips":   append(open, active...),
	})
}

func (h *PlatformHandler) ListBilling(c *gin.Context) {
	ledger, err := h.platformRepo.ListBilling(queryLimit(c, 150))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load billing"})
		return
	}
	orgID, ok := optionalOrgID(c)
	if !ok {
		return
	}
	wallets, err := h.platformRepo.ListWalletLedger(orgID, queryLimit(c, 150))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load wallets"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"standLedger": ledger, "walletLedger": wallets})
}

func (h *PlatformHandler) ListAdmins(c *gin.Context) {
	rows, err := h.platformRepo.ListAdmins()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list admins"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *PlatformHandler) GrantAdmin(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	n, err := h.platformRepo.SetAdminByPhone(req.Phone, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to grant admin"})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No user with that phone. Ask them to register first."})
		return
	}
	h.audit(c, "admin.grant", "user", strings.TrimSpace(req.Phone),
		fmt.Sprintf("Granted platform admin to %s", strings.TrimSpace(req.Phone)), nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *PlatformHandler) RevokeAdmin(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	if targetID == c.MustGet("userID").(uuid.UUID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot revoke your own admin access"})
		return
	}
	count, err := h.platformRepo.CountAdmins()
	if err == nil && count <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one platform admin is required"})
		return
	}
	if err := h.platformRepo.SetAdminByID(targetID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke admin"})
		return
	}
	h.audit(c, "admin.revoke", "user", targetID.String(), "Revoked platform admin access", nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
