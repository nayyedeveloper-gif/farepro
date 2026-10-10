package middleware

import (
	"net/http"
	"os"
	"strings"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PlatformAdminMiddleware requires authenticated user who is a platform admin
// (users.is_platform_admin = true) or whose phone is listed in PLATFORM_ADMIN_PHONES.
func PlatformAdminMiddleware(userRepo *repository.UserRepository) gin.HandlerFunc {
	allowPhones := map[string]bool{}
	for _, p := range strings.Split(os.Getenv("PLATFORM_ADMIN_PHONES"), ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			allowPhones[p] = true
		}
	}

	return func(c *gin.Context) {
		uidVal, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		userID, ok := uidVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		user, err := userRepo.GetByID(userID)
		if err != nil || user == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Platform admin required"})
			c.Abort()
			return
		}

		if user.IsPlatformAdmin || allowPhones[strings.TrimSpace(user.Phone)] {
			c.Set("isPlatformAdmin", true)
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Platform admin required"})
		c.Abort()
	}
}
