export interface PlatformOrg {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  industry: string;
  isActive: boolean;
  maxDrivers: number;
  driverCount: number;
  onlineDrivers: number;
  tripCount: number;
  billingBalanceMmk: number;
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
}

export interface PlatformOverview {
  stands: number;
  activeStands: number;
  drivers: number;
  onlineDrivers: number;
  tripsToday: number;
  completedToday: number;
  activeTrips: number;
  revenueTodayMmk: number;
  totalTrips: number;
  standCreditMmk: number;
  driverWalletMmk: number;
}

export interface DailyPoint {
  day: string;
  trips: number;
  completed: number;
  revenueMmk: number;
}

export interface PlatformDriver {
  userId: string;
  orgId: string;
  orgName: string;
  subdomain: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  isOnline: boolean;
  vehiclePlate: string;
  vehicleModel: string;
  walletMmk: number;
  completedTrips: number;
  lat?: number;
  lng?: number;
  locationStatus?: string;
  locationAt?: string;
  joinedAt: string;
}

export interface PlatformTrip {
  id: string;
  orgId: string;
  orgName: string;
  subdomain: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  status: string;
  distanceKm?: number;
  estimatedFare?: number;
  actualFare?: number;
  paymentMethod: string;
  bookingSource: string;
  driverId?: string;
  driverName: string;
  createdAt: string;
}

export interface StandLedgerRow {
  id: string;
  orgId: string;
  orgName?: string;
  amountMmk: number;
  entryType: string;
  reason: string;
  actorName?: string;
  createdAt: string;
}

export interface WalletLedgerRow {
  id: string;
  orgId: string;
  orgName: string;
  userId: string;
  driverName: string;
  amountMmk: number;
  entryType: string;
  reason: string;
  createdAt: string;
}

export interface PlatformMember {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  isOnline: boolean;
  joinedAt: string;
}

export interface PlatformAdmin {
  id: string;
  username: string;
  phone: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export const PLAN_DRIVER_LIMITS: Record<string, number> = { free: 10, pro: 50, enterprise: 200 };

export const formatMMK = (n: number | undefined | null) =>
  `${new Intl.NumberFormat('en-US').format(n || 0)} Ks`;

export const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (iso?: string) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const personName = (p: { firstName?: string; lastName?: string; username?: string }) =>
  `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.username || '—';

export const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const TRIP_STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  pending: 'Pending',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface PlatformUser {
  id: string;
  username: string;
  phone: string;
  firstName: string;
  lastName: string;
  isOnline: boolean;
  isPlatformAdmin: boolean;
  isBanned: boolean;
  bannedReason: string;
  bannedAt?: string;
  lastSeen?: string;
  createdAt: string;
  stands: string;
}

export interface PlatformAuditEntry {
  id: string;
  actorId?: string;
  actorName: string;
  actorPhone: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string;
  createdAt: string;
}

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface PlatformHealth {
  status: HealthStatus;
  checks: { name: string; status: HealthStatus; latencyMs: number; detail?: string }[];
  stats: { users: number; bannedUsers: number; stands: number; trips: number; dbSize: string } | null;
  runtime: {
    startedAt: string;
    uptimeSec: number;
    deployedAt: string;
    goVersion: string;
    goroutines: number;
    heapMb: number;
    demoEnabled: boolean;
  };
  checkedAt: string;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'stand.create': 'Stand created',
  'stand.update': 'Plan / status changed',
  'stand.topup': 'Stand credit',
  'driver.wallet_adjust': 'Driver wallet',
  'admin.grant': 'Admin granted',
  'admin.revoke': 'Admin revoked',
  'user.suspend': 'User suspended',
  'user.restore': 'User restored',
  'user.reset_password': 'Password reset',
};
