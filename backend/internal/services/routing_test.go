package services

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func resetRouteCache() {
	routeCacheMu.Lock()
	routeCache = map[string]routeCacheEntry{}
	routeCacheMu.Unlock()
}

func TestEstimateRouteUsesOSRM(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"Ok","routes":[{"distance":7340,"duration":1260,
			"geometry":{"coordinates":[[96.19,16.86],[96.20,16.87]]}}]}`))
	}))
	defer srv.Close()
	t.Setenv("OSRM_URL", srv.URL)
	t.Setenv("OSRM_TRAFFIC_FACTOR", "1")
	resetRouteCache()

	r := EstimateRoute(16.86, 96.19, 16.87, 96.20, true)
	if r.Source != "osrm" {
		t.Fatalf("source = %q, want osrm", r.Source)
	}
	if r.DistanceKm != 7.3 || r.DurationMin != 21 {
		t.Fatalf("got %.1f km / %.1f min, want 7.3 km / 21 min", r.DistanceKm, r.DurationMin)
	}
	if len(r.Geometry) != 2 || r.Geometry[0] != [2]float64{16.86, 96.19} {
		t.Fatalf("geometry not converted to lat,lng: %v", r.Geometry)
	}
}

func TestEstimateRouteAppliesTrafficFactor(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":"Ok","routes":[{"distance":3800,"duration":300,"geometry":{"coordinates":[]}}]}`))
	}))
	defer srv.Close()
	t.Setenv("OSRM_URL", srv.URL)
	resetRouteCache()

	t.Setenv("OSRM_TRAFFIC_FACTOR", "")
	if got := EstimateRoute(16.77, 96.15, 16.79, 96.14, false).DurationMin; got != 9 {
		t.Fatalf("default factor: %.1f min, want 9 (5 min x 1.8)", got)
	}
	resetRouteCache()
	t.Setenv("OSRM_TRAFFIC_FACTOR", "99")
	if got := EstimateRoute(16.77, 96.15, 16.79, 96.14, false).DurationMin; got != 9 {
		t.Fatalf("out-of-range factor should fall back to default, got %.1f min", got)
	}
}

func TestEstimateRouteFallsBackWhenOSRMFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()
	t.Setenv("OSRM_URL", srv.URL)
	resetRouteCache()

	r := EstimateRoute(16.80, 96.15, 16.85, 96.20, false)
	if r.Source != "estimate" {
		t.Fatalf("source = %q, want estimate", r.Source)
	}
	want := RoadDistanceKm(16.80, 96.15, 16.85, 96.20)
	if r.DistanceKm != want || r.DurationMin <= 0 {
		t.Fatalf("fallback = %.1f km / %.1f min, want %.1f km and positive ETA", r.DistanceKm, r.DurationMin, want)
	}
}

func TestEstimateRouteFallsBackOnTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(routeClient.Timeout + 500*time.Millisecond)
	}))
	defer srv.Close()
	t.Setenv("OSRM_URL", srv.URL)
	resetRouteCache()

	start := time.Now()
	r := EstimateRoute(16.80, 96.15, 16.81, 96.16, false)
	if r.Source != "estimate" {
		t.Fatalf("source = %q, want estimate", r.Source)
	}
	if time.Since(start) > routeClient.Timeout+time.Second {
		t.Fatalf("routing blocked too long: %v", time.Since(start))
	}
}

func TestCalculateFareMinimumAndNight(t *testing.T) {
	in := FareInput{RatePerKm: 1500, MinimumFare: 2000, NightMultiplier: 1.2, NightStartHour: 22, NightEndHour: 5}
	day := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	night := time.Date(2026, 10, 9, 23, 0, 0, 0, time.UTC)

	if got := CalculateFare(0.5, day, in); got != 2000 {
		t.Errorf("short trip fare = %d, want minimum 2000", got)
	}
	if got := CalculateFare(10, day, in); got != 15000 {
		t.Errorf("day fare = %d, want 15000", got)
	}
	if got := CalculateFare(10, night, in); got != 18000 {
		t.Errorf("night fare = %d, want 18000", got)
	}
}
