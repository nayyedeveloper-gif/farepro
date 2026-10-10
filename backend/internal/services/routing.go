package services

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Yangon average city speed used when OSRM is unavailable.
const fallbackSpeedKmh = 22.0

// OSRM durations assume free-flowing roads; city traffic is markedly slower.
const defaultTrafficFactor = 1.8

type RouteResult struct {
	DistanceKm  float64      `json:"distanceKm"`
	DurationMin float64      `json:"durationMin"`
	Source      string       `json:"source"` // osrm | estimate
	Geometry    [][2]float64 `json:"geometry,omitempty"`
}

type routeCacheEntry struct {
	result RouteResult
	at     time.Time
}

var (
	routeClient   = &http.Client{Timeout: 3 * time.Second}
	routeCache    = map[string]routeCacheEntry{}
	routeCacheMu  sync.Mutex
	routeCacheTTL = 10 * time.Minute
)

func osrmBaseURL() string {
	if u := strings.TrimSpace(os.Getenv("OSRM_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "https://router.project-osrm.org"
}

func trafficFactor() float64 {
	if v, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("OSRM_TRAFFIC_FACTOR")), 64); err == nil && v >= 1 && v <= 4 {
		return v
	}
	return defaultTrafficFactor
}

// EstimateRoute returns road distance and drive time, preferring OSRM and
// falling back to a straight-line estimate so fares never block on routing.
func EstimateRoute(fromLat, fromLng, toLat, toLng float64, withGeometry bool) RouteResult {
	key := fmt.Sprintf("%.4f,%.4f;%.4f,%.4f;%t", fromLat, fromLng, toLat, toLng, withGeometry)
	routeCacheMu.Lock()
	if e, ok := routeCache[key]; ok && time.Since(e.at) < routeCacheTTL {
		routeCacheMu.Unlock()
		return e.result
	}
	routeCacheMu.Unlock()

	result, err := osrmRoute(fromLat, fromLng, toLat, toLng, withGeometry)
	if err != nil {
		km := RoadDistanceKm(fromLat, fromLng, toLat, toLng)
		return RouteResult{
			DistanceKm:  km,
			DurationMin: math.Round(km/fallbackSpeedKmh*60*10) / 10,
			Source:      "estimate",
		}
	}

	routeCacheMu.Lock()
	if len(routeCache) > 2000 {
		routeCache = map[string]routeCacheEntry{}
	}
	routeCache[key] = routeCacheEntry{result: result, at: time.Now()}
	routeCacheMu.Unlock()
	return result
}

func osrmRoute(fromLat, fromLng, toLat, toLng float64, withGeometry bool) (RouteResult, error) {
	overview := "false"
	if withGeometry {
		overview = "simplified"
	}
	url := fmt.Sprintf("%s/route/v1/driving/%f,%f;%f,%f?overview=%s&geometries=geojson",
		osrmBaseURL(), fromLng, fromLat, toLng, toLat, overview)
	resp, err := routeClient.Get(url)
	if err != nil {
		return RouteResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return RouteResult{}, fmt.Errorf("osrm status %d", resp.StatusCode)
	}
	var body struct {
		Code   string `json:"code"`
		Routes []struct {
			Distance float64 `json:"distance"`
			Duration float64 `json:"duration"`
			Geometry struct {
				Coordinates [][2]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"routes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return RouteResult{}, err
	}
	if body.Code != "Ok" || len(body.Routes) == 0 {
		return RouteResult{}, fmt.Errorf("osrm: no route")
	}
	r := body.Routes[0]
	out := RouteResult{
		DistanceKm:  math.Round(r.Distance/100) / 10,
		DurationMin: math.Round(r.Duration*trafficFactor()/6) / 10,
		Source:      "osrm",
	}
	if withGeometry {
		out.Geometry = make([][2]float64, 0, len(r.Geometry.Coordinates))
		for _, c := range r.Geometry.Coordinates {
			out.Geometry = append(out.Geometry, [2]float64{c[1], c[0]})
		}
	}
	return out, nil
}

// CheckRouting performs one small live OSRM request for health monitoring.
func CheckRouting() (time.Duration, error) {
	start := time.Now()
	_, err := osrmRoute(16.7806, 96.1561, 16.7983, 96.1497, false)
	return time.Since(start), err
}
