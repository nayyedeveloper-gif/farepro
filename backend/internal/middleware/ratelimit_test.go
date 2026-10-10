package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func newLimitedRouter(perMinute, burst int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	_ = r.SetTrustedProxies([]string{"127.0.0.1"})
	r.Use(RateLimit(perMinute, burst))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func hit(r *gin.Engine, remote, xff string) int {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remote
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestRateLimitBlocksAfterBurst(t *testing.T) {
	r := newLimitedRouter(1, 3)
	for i := 0; i < 3; i++ {
		if code := hit(r, "203.0.113.5:1000", ""); code != http.StatusOK {
			t.Fatalf("request %d = %d, want 200", i+1, code)
		}
	}
	if code := hit(r, "203.0.113.5:1000", ""); code != http.StatusTooManyRequests {
		t.Fatalf("4th request = %d, want 429", code)
	}
	if code := hit(r, "203.0.113.9:1000", ""); code != http.StatusOK {
		t.Fatalf("other client = %d, want 200", code)
	}
}

func TestRateLimitIgnoresSpoofedForwardedFor(t *testing.T) {
	r := newLimitedRouter(1, 2)
	// Through nginx: the real client is the right-most XFF entry.
	for i, spoof := range []string{"1.1.1.1", "2.2.2.2", "3.3.3.3"} {
		code := hit(r, "127.0.0.1:5000", spoof+", 198.51.100.7")
		if i < 2 && code != http.StatusOK {
			t.Fatalf("request %d = %d, want 200", i+1, code)
		}
		if i == 2 && code != http.StatusTooManyRequests {
			t.Fatalf("spoofed XFF bypassed limiter: got %d", code)
		}
	}
}
