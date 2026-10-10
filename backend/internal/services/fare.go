package services

import (
	"math"
	"time"
)

const roadDistanceFactor = 1.35

// HaversineKm returns straight-line distance in kilometers.
func HaversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusKm = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}

// RoadDistanceKm estimates road distance from GPS coordinates (Yangon ~1.35× straight line).
func RoadDistanceKm(lat1, lng1, lat2, lng2 float64) float64 {
	km := HaversineKm(lat1, lng1, lat2, lng2) * roadDistanceFactor
	return math.Round(km*10) / 10
}

type FareInput struct {
	RatePerKm       int
	MinimumFare     int
	NightMultiplier float64
	NightStartHour  int
	NightEndHour    int
}

// CalculateFare returns fare in MMK for the given distance.
func CalculateFare(distanceKm float64, at time.Time, input FareInput) int {
	if distanceKm <= 0 {
		return input.MinimumFare
	}
	rate := input.RatePerKm
	if rate <= 0 {
		rate = 1500
	}
	minFare := input.MinimumFare
	if minFare <= 0 {
		minFare = 2000
	}
	multiplier := 1.0
	if isNightHour(at.Hour(), input.NightStartHour, input.NightEndHour) && input.NightMultiplier > 1 {
		multiplier = input.NightMultiplier
	}
	fare := int(math.Round(distanceKm * float64(rate) * multiplier))
	if fare < minFare {
		return minFare
	}
	return fare
}

func isNightHour(hour, start, end int) bool {
	if start == end {
		return false
	}
	if start < end {
		return hour >= start && hour < end
	}
	return hour >= start || hour < end
}
