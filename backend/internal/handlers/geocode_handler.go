package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const nominatimBase = "https://nominatim.openstreetmap.org"

type GeocodeHandler struct {
	client *http.Client
}

func NewGeocodeHandler() *GeocodeHandler {
	return &GeocodeHandler{
		client: &http.Client{Timeout: 8 * time.Second},
	}
}

type placeResult struct {
	DisplayName string  `json:"displayName"`
	ShortName   string  `json:"shortName"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
}

type nominatimItem struct {
	DisplayName string `json:"display_name"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Address     struct {
		Road        string `json:"road"`
		Neighbourhood string `json:"neighbourhood"`
		Suburb      string `json:"suburb"`
		City        string `json:"city"`
		Town        string `json:"town"`
		State       string `json:"state"`
	} `json:"address"`
}

func shortPlaceName(item nominatimItem) string {
	if item.Name != "" {
		parts := []string{item.Name}
		if item.Address.Suburb != "" {
			parts = append(parts, item.Address.Suburb)
		} else if item.Address.Neighbourhood != "" {
			parts = append(parts, item.Address.Neighbourhood)
		} else if item.Address.Road != "" {
			parts = append(parts, item.Address.Road)
		}
		return strings.Join(parts, ", ")
	}
	if item.Address.Road != "" {
		city := item.Address.City
		if city == "" {
			city = item.Address.Town
		}
		if city != "" {
			return item.Address.Road + ", " + city
		}
		return item.Address.Road
	}
	parts := strings.Split(item.DisplayName, ",")
	if len(parts) > 0 {
		max := 3
		if len(parts) < max {
			max = len(parts)
		}
		return strings.TrimSpace(strings.Join(parts[:max], ", "))
	}
	return item.DisplayName
}

func (h *GeocodeHandler) fetchNominatimSearch(params url.Values) ([]nominatimItem, error) {
	params.Set("format", "json")
	params.Set("addressdetails", "1")
	reqURL := nominatimBase + "/search?" + params.Encode()
	return h.doNominatim(reqURL)
}

func (h *GeocodeHandler) fetchNominatimReverse(params url.Values) (*nominatimItem, error) {
	params.Set("format", "json")
	params.Set("addressdetails", "1")
	reqURL := nominatimBase + "/reverse?" + params.Encode()

	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TeamLink-KiloTaxi/1.0 (booking; contact@teamlink.app)")
	req.Header.Set("Accept-Language", "my,en")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geocode upstream status %d", resp.StatusCode)
	}

	var item nominatimItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}
	if item.DisplayName == "" {
		return nil, fmt.Errorf("empty reverse result")
	}
	return &item, nil
}

func (h *GeocodeHandler) doNominatim(reqURL string) ([]nominatimItem, error) {
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TeamLink-KiloTaxi/1.0 (booking; contact@teamlink.app)")
	req.Header.Set("Accept-Language", "my,en")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geocode upstream status %d", resp.StatusCode)
	}

	var items []nominatimItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return items, nil
}

func mapPlaces(items []nominatimItem) []placeResult {
	out := make([]placeResult, 0, len(items))
	for _, item := range items {
		var lat, lng float64
		if _, err := fmt.Sscanf(item.Lat, "%f", &lat); err != nil {
			continue
		}
		if _, err := fmt.Sscanf(item.Lon, "%f", &lng); err != nil {
			continue
		}
		out = append(out, placeResult{
			DisplayName: item.DisplayName,
			ShortName:   shortPlaceName(item),
			Lat:         lat,
			Lng:         lng,
		})
	}
	return out
}

// SearchPlaces — Yangon-focused place search via Nominatim proxy.
func (h *GeocodeHandler) SearchPlaces(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query too short"})
		return
	}

	params := url.Values{}
	params.Set("q", q)
	params.Set("limit", "8")
	params.Set("countrycodes", "mm")
	// Yangon metro viewbox: left, top, right, bottom
	params.Set("viewbox", "96.05,17.05,96.35,16.55")
	params.Set("bounded", "0")

	items, err := h.fetchNominatimSearch(params)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Place search failed"})
		return
	}

	c.JSON(http.StatusOK, mapPlaces(items))
}

// ReverseGeocode — lat/lng to address label.
func (h *GeocodeHandler) ReverseGeocode(c *gin.Context) {
	lat := strings.TrimSpace(c.Query("lat"))
	lng := strings.TrimSpace(c.Query("lng"))
	if lat == "" || lng == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng required"})
		return
	}

	params := url.Values{}
	params.Set("lat", lat)
	params.Set("lon", lng)
	params.Set("zoom", "18")

	item, err := h.fetchNominatimReverse(params)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Reverse geocode failed"})
		return
	}

	places := mapPlaces([]nominatimItem{*item})
	c.JSON(http.StatusOK, places[0])
}
