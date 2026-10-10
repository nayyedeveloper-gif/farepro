import { apiClient } from '../utils/apiClient';

export interface PublicOrgInfo {
  name: string;
  subdomain: string;
  customerAppTitle?: string;
  bookingEnabled: boolean;
  fareRatePerKm: number;
  fareMinimum: number;
}

export interface FareEstimate {
  distanceKm: number;
  estimatedFare: number;
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
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  driverLat?: number;
  driverLng?: number;
  driver?: { firstName?: string; lastName?: string; username?: string; phone?: string };
}

export const bookingService = {
  getOrg: async (subdomain: string) => {
    const res = await apiClient.get(`/book/${subdomain}`);
    return { data: res.data as PublicOrgInfo };
  },
  estimate: async (subdomain: string, data: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }) => {
    const res = await apiClient.post(`/book/${subdomain}/estimate`, data);
    return { data: res.data as FareEstimate };
  },
  createRide: async (subdomain: string, data: {
    customerName: string;
    customerPhone: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    paymentMethod?: string;
  }) => {
    const res = await apiClient.post(`/book/${subdomain}/rides`, data);
    return { data: res.data as CustomerTrip };
  },
  getRideStatus: async (subdomain: string, tripId: string, phone: string) => {
    const res = await apiClient.get(`/book/${subdomain}/rides/${tripId}`, { params: { phone } });
    return { data: res.data as CustomerTrip };
  },
};

export function formatMMK(amount: number): string {
  return `${amount.toLocaleString()} MMK`;
}
