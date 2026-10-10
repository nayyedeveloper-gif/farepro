import { apiClient } from '../utils/apiClient';

export interface OrgContextResponse {
  hasOrg: boolean;
  role?: string;
  organization?: { id: string; name: string; subdomain: string };
  token?: string;
}

export interface TripJob {
  id: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  driverId?: string;
  customerPhone?: string;
  distanceKm?: number;
  estimatedFare?: number;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  driverLat?: number;
  driverLng?: number;
  paymentMethod?: string;
  bookingSource?: string;
  serviceType?: string;
  vehicleType?: string;
  parcelNotes?: string;
  offerExpiresAt?: string;
}

export interface WalletLedgerEntry {
  id: string;
  amountMmk: number;
  entryType: 'credit' | 'debit' | 'adjust' | 'commission' | string;
  reason?: string;
  createdAt: string;
}

export interface TopupRequest {
  id: string;
  amountMmk: number;
  method: string;
  reference: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string;
  createdAt: string;
}

export interface MyWalletResponse {
  wallet: { balanceMmk: number; updatedAt: string };
  ledger: WalletLedgerEntry[] | null;
  topupRequests: TopupRequest[] | null;
  commissionRate: number;
  commissionMin: number;
  creditFloorMmk: number;
  paymentInfo: string;
  canReceiveJobs: boolean;
  topupMethods: string[];
}

export interface RetailShift {
  id: string;
  locationName: string;
  roleLabel: string;
  status: string;
  clockIn: string;
  userId?: string;
}

export const orgService = {
  getContext: () => apiClient.get('/org/context'),
  getOrg: () => apiClient.get('/org'),
  getTrips: () => apiClient.get('/org/trips'),
  updateTrip: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/org/trips/${id}`, data),
  acceptTrip: (id: string) => apiClient.post(`/org/trips/${id}/accept`),
  rejectTrip: (id: string) => apiClient.post(`/org/trips/${id}/reject`),
  updateTripLocation: (id: string, data: { lat: number; lng: number }) =>
    apiClient.post(`/org/trips/${id}/location`, data),
  getMyShift: () => apiClient.get('/org/shifts/mine'),
  clockIn: (data: { locationName: string; roleLabel?: string }) =>
    apiClient.post('/org/shifts/clock-in', data),
  clockOut: () => apiClient.post('/org/shifts/clock-out'),
  getMyWallet: () => apiClient.get('/org/me/wallet'),
  createTopup: (data: { amountMmk: number; method: string; reference: string; note?: string }) =>
    apiClient.post('/org/me/wallet/topups', data),
  login: (data: { phone: string; password: string }, subdomain: string) =>
    apiClient.post(`/org/login?subdomain=${encodeURIComponent(subdomain)}`, data),
};
