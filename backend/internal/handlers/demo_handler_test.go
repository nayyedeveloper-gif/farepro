package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func demoRouter(h *DemoHandler, userID uuid.UUID) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/demo/accounts", h.Accounts)
	r.PUT("/profile", func(c *gin.Context) { c.Set("userID", userID) }, h.Guard, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func serve(r *gin.Engine, method, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return w
}

func TestDemoAccountsHiddenWhenDisabled(t *testing.T) {
	t.Setenv("DEMO_MODE", "")
	h := NewDemoHandler(nil, nil, nil, nil)
	if code := serve(demoRouter(h, uuid.New()), http.MethodGet, "/demo/accounts").Code; code != http.StatusNotFound {
		t.Fatalf("disabled demo = %d, want 404", code)
	}
}

func TestDemoAccountsListedWhenEnabled(t *testing.T) {
	t.Setenv("DEMO_MODE", "true")
	t.Setenv("DEMO_PASSWORD", "Sandbox#1")
	h := NewDemoHandler(nil, nil, nil, nil)
	w := serve(demoRouter(h, uuid.New()), http.MethodGet, "/demo/accounts")
	if w.Code != http.StatusOK {
		t.Fatalf("enabled demo = %d, want 200", w.Code)
	}
	var body struct {
		Accounts []DemoAccount `json:"accounts"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	kinds := map[string]int{}
	for _, a := range body.Accounts {
		kinds[a.Kind]++
		if a.Password != "Sandbox#1" {
			t.Errorf("%s password = %q", a.Key, a.Password)
		}
		if a.Kind == "stand" && a.Subdomain != demoSubdomain {
			t.Errorf("%s subdomain = %q", a.Key, a.Subdomain)
		}
	}
	if kinds["personal"] != 2 || kinds["stand"] != 2 {
		t.Fatalf("accounts by kind = %v, want 2 personal + 2 stand", kinds)
	}
}

func TestDemoGuardBlocksOnlyDemoUsers(t *testing.T) {
	t.Setenv("DEMO_MODE", "true")
	h := NewDemoHandler(nil, nil, nil, nil)
	demoID, realID := uuid.New(), uuid.New()
	h.userIDs = map[uuid.UUID]bool{demoID: true}

	if code := serve(demoRouter(h, demoID), http.MethodPut, "/profile").Code; code != http.StatusForbidden {
		t.Fatalf("demo user = %d, want 403", code)
	}
	if code := serve(demoRouter(h, realID), http.MethodPut, "/profile").Code; code != http.StatusOK {
		t.Fatalf("real user = %d, want 200", code)
	}
}
