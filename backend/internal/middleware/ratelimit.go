package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type bucket struct {
	tokens float64
	last   time.Time
}

// RateLimit is an in-memory per-IP token bucket: `perMinute` sustained, `burst` max.
// Suitable for a single backend instance; use Redis if the API is scaled out.
func RateLimit(perMinute, burst int) gin.HandlerFunc {
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	rate := float64(perMinute) / 60.0
	lastSweep := time.Now()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		if now.Sub(lastSweep) > 5*time.Minute {
			for k, b := range buckets {
				if now.Sub(b.last) > 10*time.Minute {
					delete(buckets, k)
				}
			}
			lastSweep = now
		}
		b, ok := buckets[ip]
		if !ok {
			b = &bucket{tokens: float64(burst), last: now}
			buckets[ip] = b
		}
		b.tokens += now.Sub(b.last).Seconds() * rate
		if b.tokens > float64(burst) {
			b.tokens = float64(burst)
		}
		b.last = now
		allowed := b.tokens >= 1
		if allowed {
			b.tokens--
		}
		mu.Unlock()

		if !allowed {
			c.Header("Retry-After", "10")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests, please slow down"})
			return
		}
		c.Next()
	}
}
