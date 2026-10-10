import { apiClient } from '../utils/apiClient';

export interface TripMessage {
  id: string;
  tripId: string;
  senderRole: 'driver' | 'customer';
  body: string;
  createdAt: string;
}

export interface TripCallToken {
  token: string;
  url: string;
  roomName: string;
}

export interface FleetMapData {
  drivers: Array<{
    driverId: string;
    firstName: string;
    lastName: string;
    lat: number;
    lng: number;
    status: string;
    tripId: string;
  }>;
  heat: Array<{ lat: number; lng: number; weight: number }>;
}

export const tripCommsService = {
  getMessages: async (tripId: string) => {
    const res = await apiClient.get(`/org/trips/${tripId}/messages`);
    return { data: res.data as TripMessage[] };
  },
  sendMessage: async (tripId: string, body: string) => {
    const res = await apiClient.post(`/org/trips/${tripId}/messages`, { body });
    return { data: res.data as TripMessage };
  },
  getCallToken: async (tripId: string) => {
    const res = await apiClient.post(`/org/trips/${tripId}/call/token`);
    return { data: res.data as TripCallToken };
  },
  getHistory: async () => {
    const res = await apiClient.get('/org/trips/history');
    return { data: res.data };
  },
  cancelTrip: async (tripId: string, reason?: string) => {
    const res = await apiClient.post(`/org/trips/${tripId}/cancel`, { reason: reason || '' });
    return { data: res.data };
  },
  getFleetMap: async () => {
    const res = await apiClient.get('/org/fleet/map');
    return { data: res.data as FleetMapData };
  },
  // Customer (public booking)
  customerGetMessages: async (subdomain: string, tripId: string, phone: string) => {
    const res = await apiClient.get(`/book/${subdomain}/rides/${tripId}/messages`, { params: { phone } });
    return { data: res.data as TripMessage[] };
  },
  customerSendMessage: async (subdomain: string, tripId: string, phone: string, body: string) => {
    const res = await apiClient.post(`/book/${subdomain}/rides/${tripId}/messages?phone=${encodeURIComponent(phone)}`, { body });
    return { data: res.data as TripMessage };
  },
  customerGetCallToken: async (subdomain: string, tripId: string, phone: string) => {
    const res = await apiClient.post(`/book/${subdomain}/rides/${tripId}/call/token?phone=${encodeURIComponent(phone)}`);
    return { data: res.data as TripCallToken };
  },
};
