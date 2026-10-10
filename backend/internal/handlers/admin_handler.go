package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"telegram-clone/internal/middleware"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	adminRepo *repository.AdminRepository
}

func NewAdminHandler(adminRepo *repository.AdminRepository) *AdminHandler {
	return &AdminHandler{adminRepo: adminRepo}
}

// DashboardStats returns statistics for the admin dashboard
func (h *AdminHandler) GetDashboardStats(c *gin.Context) {
	stats, err := h.adminRepo.GetDashboardStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dashboard stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetUsers returns all users with pagination
func (h *AdminHandler) GetUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")

	users, total, err := h.adminRepo.GetAllUsers(page, limit, search)
	if err != nil {
		fmt.Printf("Error getting users: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users", "details": err.Error()})
		return
	}

	response := gin.H{
		"users": users,
		"page":  page,
		"limit": limit,
		"total": total,
	}

	c.JSON(http.StatusOK, response)
}

// BanUser bans or unbans a user
func (h *AdminHandler) BanUser(c *gin.Context) {
	userIDStr := c.Param("id")
	action := c.Query("action") // "ban" or "unban"

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ban := action == "ban"
	err = h.adminRepo.BanUser(userID, ban)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ban/unban user"})
		return
	}
	middleware.InvalidateBan(userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "User " + action + "ned successfully",
		"userId":  userIDStr,
	})
}

// GetGroups returns all groups and channels
func (h *AdminHandler) GetGroups(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	groupType := c.Query("type")

	groups, total, err := h.adminRepo.GetAllGroups(page, limit, groupType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get groups"})
		return
	}

	response := gin.H{
		"groups": groups,
		"page":   page,
		"limit":  limit,
		"total":  total,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteGroup deletes a group or channel
func (h *AdminHandler) DeleteGroup(c *gin.Context) {
	groupIDStr := c.Param("id")

	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	err = h.adminRepo.DeleteGroup(groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Group deleted successfully",
		"groupId": groupIDStr,
	})
}

// GetReports returns reported content for moderation
func (h *AdminHandler) GetReports(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	status := c.Query("status")

	reports, total, err := h.adminRepo.GetAllReports(page, limit, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get reports"})
		return
	}

	response := gin.H{
		"reports": reports,
		"page":    page,
		"limit":   limit,
		"total":   total,
	}

	c.JSON(http.StatusOK, response)
}

// ModerateReport takes action on a reported content
func (h *AdminHandler) ModerateReport(c *gin.Context) {
	reportIDStr := c.Param("id")
	var request struct {
		Action string `json:"action"` // "delete", "dismiss", "block"
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	reportID, err := uuid.Parse(reportIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return
	}

	err = h.adminRepo.ModerateReport(reportID, request.Action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to moderate report"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Report " + request.Action + "ed successfully",
		"reportId": reportIDStr,
	})
}

// GetFiles returns all files with pagination
func (h *AdminHandler) GetFiles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")
	fileType := c.Query("type")

	files, total, err := h.adminRepo.GetAllFiles(page, limit, search, fileType)
	if err != nil {
		fmt.Printf("Error getting files: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get files", "details": err.Error()})
		return
	}

	response := gin.H{
		"files": files,
		"page":  page,
		"limit": limit,
		"total": total,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteFile deletes a file
func (h *AdminHandler) DeleteFile(c *gin.Context) {
	fileIDStr := c.Param("id")

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	err = h.adminRepo.DeleteFile(fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File deleted successfully",
		"fileId":  fileIDStr,
	})
}

// GetCalls returns all calls with pagination
func (h *AdminHandler) GetCalls(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	callType := c.Query("type")
	status := c.Query("status")

	calls, total, err := h.adminRepo.GetAllCalls(page, limit, callType, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get calls"})
		return
	}

	response := gin.H{
		"calls": calls,
		"page":  page,
		"limit": limit,
		"total": total,
	}

	c.JSON(http.StatusOK, response)
}

// GetUserConversations returns all conversations for a user
func (h *AdminHandler) GetUserConversations(c *gin.Context) {
	userIDStr := c.Param("id")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	conversations, err := h.adminRepo.GetUserConversations(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user conversations"})
		return
	}

	c.JSON(http.StatusOK, conversations)
}

// GetSystemSettings returns system settings
func (h *AdminHandler) GetSystemSettings(c *gin.Context) {
	settings, err := h.adminRepo.GetSystemSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get system settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateSystemSettings updates system settings
func (h *AdminHandler) UpdateSystemSettings(c *gin.Context) {
	var settings map[string]interface{}
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err := h.adminRepo.UpdateSystemSettings(settings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update system settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Settings updated successfully",
	})
}
