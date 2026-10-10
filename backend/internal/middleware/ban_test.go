package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"telegram-clone/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func authedRouter(t *testing.T) (*gin.Engine, *auth.JWTService) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	jwtSvc, err := auth.NewJWTService("test-secret-0123456789abcdef", "1h")
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.GET("/me", AuthMiddleware(jwtSvc), func(c *gin.Context) { c.Status(http.StatusOK) })
	return r, jwtSvc
}

func callMe(r *gin.Engine, token string) int {
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestAuthMiddlewareRejectsSuspendedUsers(t *testing.T) {
	r, jwtSvc := authedRouter(t)
	banned := uuid.New()
	active := uuid.New()
	SetBanLookup(func(id uuid.UUID) (bool, error) { return id == banned, nil })
	t.Cleanup(func() { SetBanLookup(nil); InvalidateBan(banned); InvalidateBan(active) })

	bannedTok, _ := jwtSvc.GenerateToken(banned, "b")
	activeTok, _ := jwtSvc.GenerateToken(active, "a")

	if code := callMe(r, bannedTok); code != http.StatusForbidden {
		t.Fatalf("suspended user: got %d, want 403", code)
	}
	if code := callMe(r, activeTok); code != http.StatusOK {
		t.Fatalf("active user: got %d, want 200", code)
	}
}

func TestBanCacheInvalidation(t *testing.T) {
	r, jwtSvc := authedRouter(t)
	id := uuid.New()
	var banned atomic.Bool
	var lookups atomic.Int32
	SetBanLookup(func(uuid.UUID) (bool, error) {
		lookups.Add(1)
		return banned.Load(), nil
	})
	t.Cleanup(func() { SetBanLookup(nil); InvalidateBan(id) })
	tok, _ := jwtSvc.GenerateToken(id, "u")

	if code := callMe(r, tok); code != http.StatusOK {
		t.Fatalf("before suspend: got %d", code)
	}
	callMe(r, tok)
	if n := lookups.Load(); n != 1 {
		t.Fatalf("expected cached lookup, got %d lookups", n)
	}

	banned.Store(true)
	InvalidateBan(id)
	if code := callMe(r, tok); code != http.StatusForbidden {
		t.Fatalf("after suspend + invalidate: got %d, want 403", code)
	}
}

func TestBanLookupErrorFailsOpen(t *testing.T) {
	r, jwtSvc := authedRouter(t)
	id := uuid.New()
	SetBanLookup(func(uuid.UUID) (bool, error) { return false, errors.New("db down") })
	t.Cleanup(func() { SetBanLookup(nil); InvalidateBan(id) })
	tok, _ := jwtSvc.GenerateToken(id, "u")
	if code := callMe(r, tok); code != http.StatusOK {
		t.Fatalf("lookup error: got %d, want 200", code)
	}
}
