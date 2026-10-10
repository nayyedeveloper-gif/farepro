package handlers

import (
	"net/http"
	"strconv"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ShiftHandler struct {
	shiftRepo *repository.ShiftRepository
	orgRepo   *repository.OrganizationRepository
}

func NewShiftHandler(
	shiftRepo *repository.ShiftRepository,
	orgRepo *repository.OrganizationRepository,
) *ShiftHandler {
	return &ShiftHandler{shiftRepo: shiftRepo, orgRepo: orgRepo}
}

func (h *ShiftHandler) resolveOrgContext(c *gin.Context) (uuid.UUID, string, bool) {
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

func (h *ShiftHandler) canViewAllShifts(role string) bool {
	return role == "owner" || role == "admin" || role == "dispatcher"
}

func (h *ShiftHandler) broadcastShift(orgID uuid.UUID, shift models.RetailShift) {
	members, err := h.orgRepo.GetOrgMembers(orgID)
	if err != nil {
		return
	}
	var ids []uuid.UUID
	for _, m := range members {
		if m.Role == "owner" || m.Role == "admin" || m.Role == "dispatcher" {
			ids = append(ids, m.UserID)
		}
	}
	if len(ids) == 0 {
		return
	}
	socket.BroadcastToUsers(ids, "shift.updated", shift)
}

func (h *ShiftHandler) ListShifts(c *gin.Context) {
	orgID, role, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	status := c.Query("status")
	if status == "" {
		status = "active"
	}
	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	if !h.canViewAllShifts(role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	shifts, err := h.shiftRepo.ListByOrg(orgID, status, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list shifts"})
		return
	}
	c.JSON(http.StatusOK, shifts)
}

func (h *ShiftHandler) GetMyShift(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	shift, err := h.shiftRepo.GetActiveForUser(orgID, userID)
	if err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, shift)
}

func (h *ShiftHandler) ClockIn(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	var req models.ClockInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roleLabel := req.RoleLabel
	if roleLabel == "" {
		roleLabel = "staff"
	}

	userID := c.MustGet("userID").(uuid.UUID)
	shift := &models.RetailShift{
		ID:           uuid.New(),
		OrgID:        orgID,
		UserID:       userID,
		LocationName: req.LocationName,
		RoleLabel:    roleLabel,
		Status:       "active",
	}

	if err := h.shiftRepo.ClockIn(shift); err != nil {
		if err.Error() == "already clocked in" {
			c.JSON(http.StatusConflict, gin.H{"error": "Already clocked in"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clock in"})
		return
	}

	full, _ := h.shiftRepo.GetByID(orgID, shift.ID)
	if full != nil {
		h.broadcastShift(orgID, *full)
		c.JSON(http.StatusCreated, full)
		return
	}
	c.JSON(http.StatusCreated, shift)
}

func (h *ShiftHandler) ClockOut(c *gin.Context) {
	orgID, _, ok := h.resolveOrgContext(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
		return
	}

	userID := c.MustGet("userID").(uuid.UUID)
	shift, err := h.shiftRepo.ClockOut(orgID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active shift to clock out"})
		return
	}

	full, _ := h.shiftRepo.GetByID(orgID, shift.ID)
	if full != nil {
		h.broadcastShift(orgID, *full)
		c.JSON(http.StatusOK, full)
		return
	}
	c.JSON(http.StatusOK, shift)
}
