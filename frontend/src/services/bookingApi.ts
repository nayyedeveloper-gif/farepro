import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface PublicOrgInfo {
  name: string;
  subdomain: string;
  logoUrl?: string;
  customerAppTitle?: string;
  bookingEnabled: boolean;
  fareRatePerKm: number;
  fareMinimum: number;
  currency: string;
}

export interface FareEstimate {
  distanceKm: number;
  estimatedFare: number;
  durationMin?: number;
  routeSource?: 'osrm' | 'estimate' | string;
  currency: string;
  ratePerKm: number;
  minimumFare: number;
}

export interface CustomerTrip {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  distanceKm?: number;
  estimatedFare?: number;
  actualFare?: number;
  paymentMethod?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  driverLat?: number;
  driverLng?: number;
  driver?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

export const bookingAPI = {
  getOrg: (subdomain: string) => api.get<PublicOrgInfo>(`/book/${subdomain}`),
  estimate: (subdomain: string, data: {
    distanceKm?: number;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
  }) => api.post<FareEstimate>(`/book/${subdomain}/estimate`, data),
  createRide: (subdomain: string, data: {
    customerName: string;
    customerPhone: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    distanceKm?: number;
    paymentMethod?: string;
  }) => api.post<CustomerTrip>(`/book/${subdomain}/rides`, data),
  getRideStatus: (subdomain: string, tripId: string, phone: string) =>
    api.get<CustomerTrip>(`/book/${subdomain}/rides/${tripId}`, { params: { phone } }),
};

export function formatMMK(amount: number): string {
  return `${amount.toLocaleString('en-US')} MMK`;
}
