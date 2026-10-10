package middleware

import (
	"net/http"
	"strings"

	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TenantMiddleware(orgRepo *repository.OrganizationRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		host := c.Request.Host
		subdomain := extractSubdomain(host)

		if subdomain == "" || subdomain == "www" || subdomain == "app" {
			c.Next()
			return
		}

		org, err := orgRepo.GetBySubdomain(subdomain)
		if err != nil || org == nil || !org.IsActive {
			c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
			c.Abort()
			return
		}

		c.Set("tenantOrgID", org.ID)
		c.Set("tenantOrg", org)
		c.Next()
	}
}

func RequireOrg() gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, exists := c.Get("orgID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
			c.Abort()
			return
		}
		_ = orgID.(uuid.UUID)
		c.Next()
	}
}

func RequireOrgRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgRole, exists := c.Get("orgRole")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Organization context required"})
			c.Abort()
			return
		}
		role := orgRole.(string)
		for _, r := range roles {
			if role == r {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

func extractSubdomain(host string) string {
	host = strings.Split(host, ":")[0]
	parts := strings.Split(host, ".")
	if len(parts) < 3 {
		return ""
	}
	return strings.ToLower(parts[0])
}
