package handlers

import (
	"net/http"
	"strings"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DriverHandler struct {
	driverRepo *repository.DriverRepository
	orgRepo    *repository.OrganizationRepository
	tripRepo   *repository.TripRepository
}

func NewDriverHandler(
	driverRepo *repository.DriverRepository,
	orgRepo *repository.OrganizationRepository,
	tripRepo *repository.TripRepository,
) *DriverHandler {
	return &DriverHandler{driverRepo: driverRepo, orgRepo: orgRepo, tripRepo: tripRepo}
}

func (h *DriverHandler) resolveOrg(c *gin.Context) (uuid.UUID, string, bool) {
	userID := c.MustGet("userID").(uuid.UUID)
	if orgIDVal, exists := c.Get("orgID"); exists {
		role, _ := c.Get("orgRole")
		roleStr, _ := role.(string)
		return orgIDVal.(uuid.UUID), roleStr, true
	}
	orgs, err := h.orgRepo.GetUserOrganizations(userID)
	if err != nil || len(orgs) == 0 {
		return uuid.Nil, "", false
	}
	return orgs[0].OrganizationID, orgs[0].Role, true
}

func (h *DriverHandler) canManage(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *DriverHandler) ListDrivers(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list members"})
		return
	}

	profiles, _ := h.driverRepo.ListProfilesByOrg(orgID)
	wallets, _ := h.driverRepo.ListWalletsByOrg(orgID)
	profileByUser := map[uuid.UUID]*models.DriverProfile{}
	walletByUser := map[uuid.UUID]*models.DriverWallet{}
	for i := range profiles {
		p := profiles[i]
		profileByUser[p.UserID] = &p
	}
	for i := range wallets {
		w := wallets[i]
		walletByUser[w.UserID] = &w
	}

	out := []models.DriverRosterItem{}
	for _, m := range members {
		if m.Role != "driver" {
			continue
		}
		_ = h.driverRepo.EnsureProfileAndWallet(orgID, m.UserID)
		if profileByUser[m.UserID] == nil {
			if p, err := h.driverRepo.GetProfile(orgID, m.UserID); err == nil {
				profileByUser[m.UserID] = p
			}
		}
		if walletByUser[m.UserID] == nil {
			if w, err := h.driverRepo.GetWallet(orgID, m.UserID); err == nil {
				walletByUser[m.UserID] = w
			}
		}
		active, completed, cancelled, _ := h.driverRepo.CountTripsByDriver(orgID, m.UserID)
		out = append(out, models.DriverRosterItem{
			Membership:     m,
			Profile:        profileByUser[m.UserID],
			Wallet:         walletByUser[m.UserID],
			ActiveTrips:    active,
			CompletedTrips: completed,
			CancelledTrips: cancelled,
		})
	}

	c.JSON(http.StatusOK, out)
}

func (h *DriverHandler) GetDriver(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || !h.canManage(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	memberRole, err := h.orgRepo.GetUserOrgRole(userID, orgID)
	if err != nil || memberRole == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not in organization"})
		return
	}

	_ = h.driverRepo.EnsureProfileAndWallet(orgID, userID)
	profile, _ := h.driverRepo.GetProfile(orgID, userID)
	wallet, _ := h.driverRepo.GetWallet(orgID, userID)
	ledger, _ := h.driverRepo.ListLedger(orgID, userID, 20)
	active, completed, cancelled, _ := h.driverRepo.CountTripsByDriver(orgID, userID)

	trips, _ := h.tripRepo.ListByOrgFiltered(orgID, "", "taxi", 100)
	driverTrips := []models.Trip{}
	for _, t := range trips {
		if t.DriverID != nil && *t.DriverID == userID {
			driverTrips = append(driverTrips, t)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":         userID,
		"role":           memberRole,
		"profile":        profile,
		"wallet":         wallet,
		"ledger":         ledger,
		"activeTrips":    active,
		"completedTrips": completed,
		"cancelledTrips": cancelled,
		"trips":          driverTrips,
	})
}

func (h *DriverHandler) UpdateProfile(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	var req models.UpdateDriverProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.VehiclePlate = strings.TrimSpace(req.VehiclePlate)
	req.VehicleModel = strings.TrimSpace(req.VehicleModel)
	req.VehicleColor = strings.TrimSpace(req.VehicleColor)
	req.LicenseNo = strings.TrimSpace(req.LicenseNo)
	req.NRC = strings.TrimSpace(req.NRC)
	req.Notes = strings.TrimSpace(req.Notes)

	profile, err := h.driverRepo.UpsertProfile(orgID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *DriverHandler) AdjustWallet(c *gin.Context) {
	orgID, role, ok := h.resolveOrg(c)
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	var req models.AdjustDriverWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.AmountMMK == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amountMmk required"})
		return
	}
	entry := strings.ToLower(strings.TrimSpace(req.EntryType))
	if entry == "" {
		entry = "adjust"
	}
	if entry != "credit" && entry != "debit" && entry != "adjust" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entryType must be credit, debit, or adjust"})
		return
	}

	if memberRole, err := h.orgRepo.GetUserOrgRole(userID, orgID); err != nil || memberRole != "driver" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found in this stand"})
		return
	}

	actorID := c.MustGet("userID").(uuid.UUID)
	wallet, err := h.driverRepo.AdjustWallet(orgID, userID, actorID, req.AmountMMK, entry, strings.TrimSpace(req.Reason))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, wallet)
}
