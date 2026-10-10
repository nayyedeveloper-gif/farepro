/** Fare meter math — mirrors backend/internal/services/fare.go + Bros-AI FarePRO GPS trip meter. */

export type FareRates = {
  ratePerKm: number;
  minimumFare: number;
  nightMultiplier: number;
  nightStartHour: number;
  nightEndHour: number;
};

export const DEFAULT_FARE_RATES: FareRates = {
  ratePerKm: 1500,
  minimumFare: 2000,
  nightMultiplier: 1.2,
  nightStartHour: 22,
  nightEndHour: 5,
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNightHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/** Same rules as Go CalculateFare — returns MMK integer. */
export function calculateFare(distanceKm: number, at: Date, rates: FareRates): number {
  const rate = rates.ratePerKm > 0 ? rates.ratePerKm : DEFAULT_FARE_RATES.ratePerKm;
  const minFare = rates.minimumFare > 0 ? rates.minimumFare : DEFAULT_FARE_RATES.minimumFare;
  if (distanceKm <= 0) return minFare;

  let multiplier = 1;
  if (
    isNightHour(at.getHours(), rates.nightStartHour, rates.nightEndHour) &&
    rates.nightMultiplier > 1
  ) {
    multiplier = rates.nightMultiplier;
  }

  const fare = Math.round(distanceKm * rate * multiplier);
  return fare < minFare ? minFare : fare;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatKm(km: number): string {
  return km.toFixed(2);
}
