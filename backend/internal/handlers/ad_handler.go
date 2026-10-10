package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"telegram-clone/internal/repository"
)

type AdHandler struct {
	adRepo *repository.AdRepository
}

func NewAdHandler(adRepo *repository.AdRepository) *AdHandler {
	return &AdHandler{adRepo: adRepo}
}

// GetActiveAds returns all currently active ads
func (h *AdHandler) GetActiveAds(c *gin.Context) {
	ads, err := h.adRepo.GetActiveAds()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active ads"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ads": ads})
}

// GetAllAds returns all ads with pagination (admin only)
func (h *AdHandler) GetAllAds(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	ads, total, err := h.adRepo.GetAllAds(page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ads"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ads":   ads,
		"page":  page,
		"limit": limit,
		"total": total,
	})
}

// CreateAd creates a new ad (admin only)
func (h *AdHandler) CreateAd(c *gin.Context) {
	var ad map[string]interface{}
	if err := c.ShouldBindJSON(&ad); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate required fields
	if ad["title"] == nil || ad["type"] == nil || ad["contentUrl"] == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: title, type, contentUrl"})
		return
	}

	// Set default values
	if ad["duration"] == nil {
		ad["duration"] = 5 // Default 5 seconds
	}
	if ad["isActive"] == nil {
		ad["isActive"] = true
	}

	id, err := h.adRepo.CreateAd(ad)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ad"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Ad created successfully",
		"adId":    id.String(),
	})
}

// UpdateAd updates an existing ad (admin only)
func (h *AdHandler) UpdateAd(c *gin.Context) {
	adIDStr := c.Param("id")
	adID, err := uuid.Parse(adIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
		return
	}

	var ad map[string]interface{}
	if err := c.ShouldBindJSON(&ad); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err = h.adRepo.UpdateAd(adID, ad)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ad"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Ad updated successfully",
		"adId":    adIDStr,
	})
}

// DeleteAd deletes an ad (admin only)
func (h *AdHandler) DeleteAd(c *gin.Context) {
	adIDStr := c.Param("id")
	adID, err := uuid.Parse(adIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
		return
	}

	err = h.adRepo.DeleteAd(adID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ad"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Ad deleted successfully",
		"adId":    adIDStr,
	})
}

// TrackImpression tracks an ad impression
func (h *AdHandler) TrackImpression(c *gin.Context) {
	adIDStr := c.Param("id")
	adID, err := uuid.Parse(adIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
		return
	}

	err = h.adRepo.TrackImpression(adID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track impression"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Impression tracked"})
}

// TrackClick tracks an ad click
func (h *AdHandler) TrackClick(c *gin.Context) {
	adIDStr := c.Param("id")
	adID, err := uuid.Parse(adIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ad ID"})
		return
	}

	err = h.adRepo.TrackClick(adID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track click"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Click tracked"})
}

// GetAdAnalytics returns analytics for all ads (admin only)
func (h *AdHandler) GetAdAnalytics(c *gin.Context) {
	analytics, err := h.adRepo.GetAdAnalytics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ad analytics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"analytics": analytics})
}
