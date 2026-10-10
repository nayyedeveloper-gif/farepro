import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';
import TopupRequestsPanel from './TopupRequestsPanel';
import GeofenceZonesTab from './GeofenceZonesTab';
import { BrandMark } from '../brand/BrandMark';
import { clearOrgContext, syncOrgContext } from '../../utils/orgStorage';
import {
  getMapCenter,
  addTileLayer,
  setupMapResizeObserver,
  updateMyLocationMarker,
  fitToLatLngs,
  getCurrentPosition,
} from '../../utils/leafletMap';
import {
  LocateIcon,
  RefreshCwIcon,
  MaximizeIcon,
  SearchIcon,
  UsersIcon,
  MicIcon,
  LinkIcon,
  CopyIcon,
  AlertIcon,
} from '../icons/Icons';

interface OrgInfo {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  industry?: string;
  maxDrivers: number;
  maxChannels: number;
  logoUrl: string;
  driverCount: number;
  channelCount: number;
  isActive: boolean;
  createdAt: string;
  fareRatePerKm?: number;
  fareMinimum?: number;
  fareNightMultiplier?: number;
  fareNightStart?: number;
  fareNightEnd?: number;
  bookingEnabled?: boolean;
  customerAppTitle?: string;
  billingBalanceMmk?: number;
}

interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    phone: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
    isOnline: boolean;
  };
}

interface DriverLocation {
  id: string;
  channelId: string;
  userId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  status: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
}

interface DriverRosterItem {
  membership: OrgMember;
  profile?: {
    vehiclePlate?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licenseNo?: string;
    nrc?: string;
    notes?: string;
  };
  wallet?: { balanceMmk?: number };
  activeTrips?: number;
  completedTrips?: number;
  cancelledTrips?: number;
}

type Tab = 'dashboard' | 'taxi' | 'drivers' | 'team' | 'customers' | 'reports' | 'map' | 'alerts' | 'zones' | 'wallets' | 'booking' | 'channels' | 'ptt' | 'profile';

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'taxi', label: 'Rides' },
  { id: 'map', label: 'Map' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'ptt', label: 'PTT' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'alerts', label: 'Alerts' },
];

const MORE_TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'reports', label: 'Reports', hint: 'Revenue and trip analytics' },
  { id: 'customers', label: 'Customers', hint: 'Passengers and repeat riders' },
  { id: 'team', label: 'Team', hint: 'Dispatchers and staff' },
  { id: 'channels', label: 'Channels', hint: 'Radio channels for your drivers' },
  { id: 'zones', label: 'Zones', hint: 'Geofences and stand areas' },
  { id: 'booking', label: 'Booking page', hint: 'Online booking link for customers' },
];

interface OrgCustomer {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  notes?: string;
  tripCount: number;
  lastTripAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DailyOpsReport {
  date: string;
  totalTrips: number;
  completed: number;
  cancelled: number;
  active: number;
  requested: number;
  fareTotal: number;
  drivers: Array<{
    driverId: string;
    firstName: string;
    lastName: string;
    username: string;
    completedTrips: number;
    fareTotal: number;
    walletBalance: number;
  }>;
}

interface PTTChannel {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  isPrivate?: boolean;
  organizationId?: string;
}

interface PTTHistoryItem {
  id: string;
  channelId: string;
  userId: string;
  fileUrl: string;
  durationMs: number;
  transcriptionText?: string;
  transcriptionStatus?: string;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

type OpsFilter = 'all' | 'requested' | 'assigned' | 'en_route' | 'arrived' | 'done' | 'cancelled';

function isLiveTrip(t: { status: string }) {
  return !['completed', 'cancelled'].includes(t.status);
}

const STATUS_COLORS: Record<string, string> = {
  available: '#2d9c78',
  busy: '#f39c12',
  off: '#888',
};

function createDriverIcon(status: string, label: string, heading: number, avatarUrl?: string, selected = false): L.DivIcon {
  const color = STATUS_COLORS[status] || '#888';
  const rotation = heading ? `transform: rotate(${heading}deg);` : '';
  const inner = avatarUrl
    ? `<img class="ptt-driver-avatar" src="${avatarUrl}" alt="" />`
    : `<span class="ptt-driver-initial">${label}</span>`;
  const selectedClass = selected ? ' selected' : '';
  return L.divIcon({
    className: 'ptt-driver-marker',
    html: `
      <div class="ptt-driver-pin${selectedClass}" style="--pin-color: ${color};">
        <div class="ptt-driver-rotate" style="${rotation}">
          <svg class="ptt-driver-arrow-svg" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
            <path d="M7 0L13.062 9.75H0.938L7 0Z" fill="var(--pin-color, #F26522)"/>
          </svg>
          <div class="ptt-driver-label">${inner}</div>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

export default function OwnerPortal() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { subscribe } = useSocket();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!moreMenuRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);
  const [loading, setLoading] = useState(true);
  const [inviteForm, setInviteForm] = useState({ phone: '', firstName: '', lastName: '', role: 'driver' });
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [orgRole, setOrgRole] = useState<string>('');
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [opsFilter, setOpsFilter] = useState<OpsFilter>('all');
  const [opsSearch, setOpsSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | 'owner' | 'admin' | 'dispatcher'>('all');
  const [staffBusyId, setStaffBusyId] = useState('');
  const [customers, setCustomers] = useState<OrgCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerBusy, setCustomerBusy] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', notes: '' });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerTrips, setCustomerTrips] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyReport, setDailyReport] = useState<DailyOpsReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'enter' | 'exit'>('all');
  const [walletSearch, setWalletSearch] = useState('');
  const [bookingKm, setBookingKm] = useState(5);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [bookingBusy, setBookingBusy] = useState('');
  const [driverRoster, setDriverRoster] = useState<DriverRosterItem[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    vehiclePlate: '', vehicleModel: '', vehicleColor: '', licenseNo: '', nrc: '', notes: '',
  });
  const [walletForm, setWalletForm] = useState({ amountMmk: 0, entryType: 'credit' as 'credit' | 'debit' | 'adjust', reason: '' });
  const [driverBusy, setDriverBusy] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');
  const [mapFocusUserId, setMapFocusUserId] = useState<string | null>(null);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [mapSyncedAt, setMapSyncedAt] = useState<Date | null>(null);
  const [fareForm, setFareForm] = useState({
    fareRatePerKm: 1500,
    fareMinimum: 2000,
    fareNightMultiplier: 1.2,
    fareNightStart: 22,
    fareNightEnd: 5,
    bookingEnabled: true,
    customerAppTitle: '',
    autoDispatch: false,
    driverCreditFloorMmk: -5000,
    walletPaymentInfo: '',
  });
  const [fareSaved, setFareSaved] = useState('');
  const [channels, setChannels] = useState<PTTChannel[]>([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [channelForm, setChannelForm] = useState({ name: '', description: '', isPrivate: false });
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [manageChannelId, setManageChannelId] = useState<string | null>(null);
  const [channelMembers, setChannelMembers] = useState<Array<{
    userId: string;
    role: string;
    user?: { firstName?: string; lastName?: string; username?: string; phone?: string };
  }>>([]);
  const [addMemberId, setAddMemberId] = useState('');
  const [channelBusy, setChannelBusy] = useState('');
  const [pttChannelId, setPttChannelId] = useState('');
  const [pttHistory, setPttHistory] = useState<PTTHistoryItem[]>([]);
  const [pttBusy, setPttBusy] = useState('');
  const [driverPttBusy, setDriverPttBusy] = useState('');

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const locationsRef = useRef<DriverLocation[]>([]);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const myLocationCoordsRef = useRef<[number, number] | null>(null);
  const hasFittedFleetRef = useRef(false);

  useEffect(() => { locationsRef.current = locations; }, [locations]);

  const loadCustomers = useCallback(async (q?: string) => {
    try {
      const res = await orgAPI.getCustomers(q);
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setCustomers([]);
    }
  }, []);

  const loadDailyReport = useCallback(async (date?: string) => {
    setReportBusy(true);
    try {
      const res = await orgAPI.getDailyReport(date);
      setDailyReport(res.data || null);
    } catch (err) {
      console.error('Failed to load daily report:', err);
      setDailyReport(null);
    } finally {
      setReportBusy(false);
    }
  }, []);

  const loadOrg = useCallback(async () => {
    try {
      const res = await orgAPI.getOrg();
      setOrg(res.data);
      setCompanyNameDraft(res.data.name || '');
      setFareForm({
        fareRatePerKm: res.data.fareRatePerKm ?? 1500,
        fareMinimum: res.data.fareMinimum ?? 2000,
        fareNightMultiplier: res.data.fareNightMultiplier ?? 1.2,
        fareNightStart: res.data.fareNightStart ?? 22,
        fareNightEnd: res.data.fareNightEnd ?? 5,
        bookingEnabled: res.data.bookingEnabled ?? true,
        customerAppTitle: res.data.customerAppTitle ?? '',
        autoDispatch: res.data.autoDispatch ?? false,
        driverCreditFloorMmk: res.data.driverCreditFloorMmk ?? -5000,
        walletPaymentInfo: res.data.walletPaymentInfo ?? '',
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        clearOrgContext();
        navigate('/org/signin');
        return;
      }
      console.error('Failed to load org:', err);
    }
  }, [navigate]);

  const loadOperations = useCallback(async () => {
    try {
      const [tripsRes, alertsRes] = await Promise.all([
        orgAPI.getTrips(),
        orgAPI.getGeofenceAlerts(50),
      ]);
      setActiveTrips(tripsRes.data || []);
      setRecentAlerts(alertsRes.data || []);
    } catch (err) {
      console.error('Failed to load operations:', err);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const membersRes = await orgAPI.getMembers();
      const list: OrgMember[] = membersRes.data || [];
      setMembers(list);

      let roster: DriverRosterItem[] = [];
      try {
        const driversRes = await orgAPI.getDrivers();
        roster = driversRes.data || [];
      } catch {
        roster = [];
      }

      if (roster.length === 0) {
        roster = list
          .filter(m => m.role === 'driver')
          .map(m => ({
            membership: m,
            profile: undefined,
            wallet: { balanceMmk: 0 },
            activeTrips: 0,
            completedTrips: 0,
            cancelledTrips: 0,
          }));
      }
      setDriverRoster(roster);
    } catch (err: any) {
      if (err.response?.status === 403) {
        clearOrgContext();
        navigate('/org/signin');
        return;
      }
      console.error('Failed to load members:', err);
    }
  }, [navigate]);

  const loadOrgChannels = useCallback(async () => {
    try {
      const res = await orgAPI.getChannels();
      setChannels(res.data || []);
    } catch (err) {
      console.error('Failed to load org channels:', err);
      try {
        const fallback = await api.get('/channels/mine');
        setChannels(fallback.data || []);
      } catch {
        setChannels([]);
      }
    }
  }, []);

  const loadAllLocations = useCallback(async () => {
    if (!org) return;
    try {
      await loadOrgChannels();
      const channelsRes = await api.get('/channels/mine');
      const list: PTTChannel[] = channelsRes.data || [];
      setPttChannelId(prev => prev || (list[0]?.id ?? ''));
      const perChannel = await Promise.all(list.map(ch =>
        api.get<DriverLocation[]>(`/channels/${ch.id}/locations`).then(r => r.data || []).catch(() => []),
      ));
      const latest = new Map<string, DriverLocation>();
      for (const loc of perChannel.flat()) {
        const prev = latest.get(loc.userId);
        if (!prev || new Date(loc.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
          latest.set(loc.userId, loc);
        }
      }
      setLocations([...latest.values()]);
      setMapSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  }, [org, loadOrgChannels]);

  const loadPttHistory = useCallback(async (channelId: string) => {
    if (!channelId) {
      setPttHistory([]);
      return;
    }
    setPttBusy('Loading…');
    try {
      const res = await api.get(`/channels/${channelId}/ptt-history?limit=50`);
      setPttHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load PTT history:', err);
      setPttHistory([]);
    } finally {
      setPttBusy('');
    }
  }, []);

  const openCreateChannel = () => {
    setEditingChannelId(null);
    setChannelForm({ name: '', description: '', isPrivate: false });
    setShowChannelModal(true);
  };

  const openEditChannel = (ch: PTTChannel) => {
    setEditingChannelId(ch.id);
    setChannelForm({
      name: ch.name,
      description: ch.description?.startsWith('driver-ptt:') ? '' : (ch.description || ''),
      isPrivate: !!ch.isPrivate,
    });
    setShowChannelModal(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name.trim()) return;
    setChannelBusy(editingChannelId ? 'Saving…' : 'Creating…');
    try {
      if (editingChannelId) {
        await orgAPI.updateChannel(editingChannelId, {
          name: channelForm.name.trim(),
          description: channelForm.description.trim(),
          isPrivate: channelForm.isPrivate,
        });
      } else {
        await orgAPI.createChannel({
          name: channelForm.name.trim(),
          description: channelForm.description.trim(),
          isPrivate: channelForm.isPrivate,
        });
      }
      setShowChannelModal(false);
      setEditingChannelId(null);
      await loadOrgChannels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save channel');
    } finally {
      setChannelBusy('');
    }
  };

  const handleDeleteChannel = async (ch: PTTChannel) => {
    if (!window.confirm(`Delete channel "${ch.name}"?`)) return;
    try {
      await orgAPI.deleteChannel(ch.id);
      if (pttChannelId === ch.id) setPttChannelId('');
      if (manageChannelId === ch.id) setManageChannelId(null);
      await loadOrgChannels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete channel');
    }
  };

  const openManageChannel = async (channelId: string) => {
    setManageChannelId(channelId);
    setAddMemberId('');
    setChannelBusy('Loading members…');
    try {
      const res = await orgAPI.getChannelMembers(channelId);
      setChannelMembers(res.data || []);
    } catch {
      setChannelMembers([]);
    } finally {
      setChannelBusy('');
    }
  };

  const handleAddChannelMember = async () => {
    if (!manageChannelId || !addMemberId) return;
    setChannelBusy('Adding…');
    try {
      await orgAPI.addChannelMember(manageChannelId, addMemberId);
      const res = await orgAPI.getChannelMembers(manageChannelId);
      setChannelMembers(res.data || []);
      setAddMemberId('');
      await loadOrgChannels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add member');
    } finally {
      setChannelBusy('');
    }
  };

  const handleRemoveChannelMember = async (userId: string) => {
    if (!manageChannelId) return;
    try {
      await orgAPI.removeChannelMember(manageChannelId, userId);
      setChannelMembers(prev => prev.filter(m => m.userId !== userId));
      await loadOrgChannels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const openChannelPTT = (channelId: string) => {
    navigate(`/app?channel=${encodeURIComponent(channelId)}`);
  };

  const handleDriverPTT = async (userId: string, displayName: string) => {
    setDriverPttBusy(userId);
    try {
      const res = await orgAPI.ensureDriverPttChannel(userId);
      const channelId = res.data?.id;
      if (!channelId) throw new Error('No channel');
      await loadOrgChannels();
      navigate(`/app?channel=${encodeURIComponent(channelId)}`);
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to open PTT with ${displayName}`);
    } finally {
      setDriverPttBusy('');
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ctx = await syncOrgContext();
      if (cancelled) return;

      if (!ctx.hasOrg || !ctx.role) {
        navigate('/org/signin');
        return;
      }

      if (ctx.role === 'dispatcher') {
        navigate('/dispatch');
        return;
      }

      if (ctx.role !== 'owner' && ctx.role !== 'admin') {
        navigate('/app');
        return;
      }

      setOrgRole(ctx.role);
      await Promise.all([loadOrg(), loadMembers(), loadOperations(), loadCustomers()]);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [navigate, loadOrg, loadMembers, loadOperations, loadCustomers]);

  useEffect(() => {
    if (activeTab === 'customers') {
      void loadCustomers(customerSearch.trim() || undefined);
    }
  }, [activeTab, customerSearch, loadCustomers]);

  useEffect(() => {
    if (activeTab === 'reports') {
      void loadDailyReport(reportDate);
    }
  }, [activeTab, reportDate, loadDailyReport]);

  useEffect(() => {
    if (org) loadAllLocations();
  }, [org, loadAllLocations]);

  useEffect(() => {
    if (activeTab === 'ptt' && pttChannelId) {
      void loadPttHistory(pttChannelId);
    }
  }, [activeTab, pttChannelId, loadPttHistory]);

  useEffect(() => {
    const unsub = subscribe('channel.location', (data: unknown) => {
      const loc = data as DriverLocation;
      setLocations(prev => {
        const filtered = prev.filter(l => l.userId !== loc.userId);
        return [...filtered, loc];
      });
    });
    const unsub2 = subscribe('channel.location_cleared', (data: unknown) => {
      const payload = data as { userId: string };
      setLocations(prev => prev.filter(l => l.userId !== payload.userId));
    });
    return () => { unsub(); unsub2(); };
  }, [subscribe]);

  useEffect(() => {
    const unsub = subscribe('trip.updated', () => {
      loadOperations();
    });
    return () => unsub();
  }, [subscribe, loadOperations]);

  useEffect(() => {
    const unsub = subscribe('geofence.alert', (data: unknown) => {
      const alert = data as {
        id: string;
        eventType: string;
        userId: string;
        createdAt?: string;
        zone?: { name: string };
        user?: { firstName: string; username: string };
        latitude?: number;
        longitude?: number;
      };
      if (!alert?.id) return;
      setRecentAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)].slice(0, 50));
    });
    return () => unsub();
  }, [subscribe]);

  useEffect(() => {
    if (activeTab !== 'map' || !mapContainerRef.current || mapRef.current) return;

    let disposed = false;
    const container = mapContainerRef.current;

    (async () => {
      const center = await getMapCenter();
      if (disposed || !mapContainerRef.current) return;

      const map = L.map(container, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      addTileLayer(map);
      mapRef.current = map;

      myLocationCoordsRef.current = center;
      updateMyLocationMarker(map, myLocationMarkerRef, center[0], center[1]);
      setupMapResizeObserver(map, container);
    })();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = {};
      myLocationMarkerRef.current = null;
      hasFittedFleetRef.current = false;
    };
  }, [activeTab]);

  const filteredLocations = locations.filter((loc) => {
    if (mapStatusFilter === 'available' && loc.status !== 'available') return false;
    if (mapStatusFilter === 'busy' && loc.status !== 'busy') return false;
    if (mapStatusFilter === 'offline') return false;
    if (!mapSearch.trim()) return true;
    const q = mapSearch.toLowerCase();
    const name = `${loc.user?.firstName || ''} ${loc.user?.lastName || ''} ${loc.user?.username || ''}`.toLowerCase();
    const plate = driverRoster.find(d => d.membership.userId === loc.userId)?.profile?.vehiclePlate?.toLowerCase() || '';
    return name.includes(q) || loc.status.toLowerCase().includes(q) || plate.includes(q);
  });

  const refreshMapLocations = useCallback(async () => {
    setMapRefreshing(true);
    try {
      await loadAllLocations();
    } finally {
      setMapRefreshing(false);
    }
  }, [loadAllLocations]);

  useEffect(() => {
    if (activeTab !== 'map') return;
    void loadAllLocations();
    const t = window.setInterval(() => { void loadAllLocations(); }, 15000);
    return () => window.clearInterval(t);
  }, [activeTab, loadAllLocations]);

  const centerOnMe = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      myLocationCoordsRef.current = [lat, lng];
      updateMyLocationMarker(mapRef.current, myLocationMarkerRef, lat, lng);
      mapRef.current.setView([lat, lng], 16);
    } catch {
      if (myLocationCoordsRef.current) {
        mapRef.current.setView(myLocationCoordsRef.current, 16);
      }
    }
  }, []);

  const fitFleetOnMap = useCallback(() => {
    if (!mapRef.current) return;
    const points: [number, number][] = filteredLocations.map(l => [l.latitude, l.longitude]);
    if (myLocationCoordsRef.current) points.push(myLocationCoordsRef.current);
    if (points.length === 0) {
      void centerOnMe();
      return;
    }
    fitToLatLngs(mapRef.current, points, 15);
    hasFittedFleetRef.current = true;
  }, [filteredLocations, centerOnMe]);

  const focusDriverOnMap = useCallback((userId: string, lat?: number, lng?: number) => {
    setMapFocusUserId(userId);
    if (!mapRef.current) return;
    const loc = locations.find(l => l.userId === userId);
    const point: [number, number] | null = loc
      ? [loc.latitude, loc.longitude]
      : (lat != null && lng != null ? [lat, lng] : null);
    if (!point) return;
    mapRef.current.setView(point, 17);
    const marker = markersRef.current[userId];
    if (marker) marker.openPopup();
  }, [locations]);

  useEffect(() => {
    if (!mapRef.current || activeTab !== 'map') return;
    const map = mapRef.current;
    const currentIds = new Set<string>();

    for (const loc of filteredLocations) {
      currentIds.add(loc.userId);
      const name = loc.user?.firstName || loc.user?.username || '?';
      const label = name.charAt(0).toUpperCase();
      const avatarUrl = loc.user?.avatarUrl || undefined;
      const selected = mapFocusUserId === loc.userId;
      const icon = createDriverIcon(loc.status, label, loc.heading, avatarUrl, selected);
      const plate = driverRoster.find(d => d.membership.userId === loc.userId)?.profile?.vehiclePlate;
      const popup = `
        <div class="owner-map-popup">
          <strong>${name}</strong>
          <span>${loc.status}${plate ? ` · ${plate}` : ''}</span>
          <span>${(loc.speed || 0).toFixed(0)} km/h</span>
        </div>
      `;

      if (markersRef.current[loc.userId]) {
        markersRef.current[loc.userId].setLatLng([loc.latitude, loc.longitude]);
        markersRef.current[loc.userId].setIcon(icon);
        markersRef.current[loc.userId].setPopupContent(popup);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindPopup(popup);
        marker.on('click', () => setMapFocusUserId(loc.userId));
        markersRef.current[loc.userId] = marker;
      }
    }

    for (const userId of Object.keys(markersRef.current)) {
      if (!currentIds.has(userId)) {
        map.removeLayer(markersRef.current[userId]);
        delete markersRef.current[userId];
      }
    }

    if (!hasFittedFleetRef.current && filteredLocations.length > 0) {
      const points: [number, number][] = filteredLocations.map(l => [l.latitude, l.longitude]);
      if (myLocationCoordsRef.current) points.push(myLocationCoordsRef.current);
      fitToLatLngs(map, points, 14);
      hasFittedFleetRef.current = true;
    }
  }, [filteredLocations, activeTab, mapFocusUserId, driverRoster]);

  const openDriverDetail = (userId: string, item?: DriverRosterItem) => {
    setSelectedDriverId(userId);
    const p = item?.profile;
    setProfileForm({
      vehiclePlate: p?.vehiclePlate || '',
      vehicleModel: p?.vehicleModel || '',
      vehicleColor: p?.vehicleColor || '',
      licenseNo: p?.licenseNo || '',
      nrc: p?.nrc || '',
      notes: p?.notes || '',
    });
    setWalletForm({ amountMmk: 0, entryType: 'credit', reason: '' });
    setDriverBusy('');
  };

  const handleSaveProfile = async () => {
    if (!selectedDriverId) return;
    setDriverBusy('Saving profile…');
    try {
      await orgAPI.updateDriverProfile(selectedDriverId, profileForm);
      await loadMembers();
      setDriverBusy('Profile saved');
    } catch (err: any) {
      setDriverBusy(err.response?.data?.error || 'Failed to save profile');
    }
  };

  const handleAdjustWallet = async () => {
    if (!selectedDriverId || !walletForm.amountMmk) return;
    setDriverBusy('Updating wallet…');
    try {
      await orgAPI.adjustDriverWallet(selectedDriverId, walletForm);
      await loadMembers();
      setWalletForm({ amountMmk: 0, entryType: 'credit', reason: '' });
      setDriverBusy('Wallet updated');
    } catch (err: any) {
      setDriverBusy(err.response?.data?.error || 'Failed to update wallet');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      await orgAPI.inviteDriver(inviteForm);
      setInviteSuccess(`${inviteForm.firstName || 'Driver'} added successfully`);
      setInviteForm({ phone: '', firstName: '', lastName: '', role: 'driver' });
      setShowInviteModal(false);
      loadMembers();
      loadOrg();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleSaveCompanyName = async () => {
    if (!companyNameDraft.trim() || companyNameDraft === org?.name) return;
    await handleUpdateOrg({ name: companyNameDraft.trim() });
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from organization?`)) return;
    try {
      await orgAPI.removeMember(userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
      loadOrg();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleChangeStaffRole = async (userId: string, role: string, name: string) => {
    if (!role) return;
    setStaffBusyId(userId);
    try {
      await orgAPI.updateMemberRole(userId, role);
      await loadMembers();
      if (role === 'driver') {
        setActiveTab('drivers');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to update role for ${name}`);
    } finally {
      setStaffBusyId('');
    }
  };

  const openCreateCustomer = () => {
    setEditingCustomerId(null);
    setCustomerForm({ name: '', phone: '', notes: '' });
    setCustomerBusy('');
    setShowCustomerModal(true);
  };

  const openEditCustomer = (c: OrgCustomer) => {
    setEditingCustomerId(c.id);
    setCustomerForm({ name: c.name, phone: c.phone, notes: c.notes || '' });
    setCustomerBusy('');
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerBusy('Saving…');
    try {
      if (editingCustomerId) {
        await orgAPI.updateCustomer(editingCustomerId, customerForm);
      } else {
        await orgAPI.createCustomer(customerForm);
      }
      setShowCustomerModal(false);
      await loadCustomers(customerSearch.trim() || undefined);
      setCustomerBusy('');
    } catch (err: any) {
      setCustomerBusy(err.response?.data?.error || 'Failed to save customer');
    }
  };

  const handleDeleteCustomer = async (c: OrgCustomer) => {
    if (!window.confirm(`Delete customer "${c.name}" (${c.phone})?`)) return;
    try {
      await orgAPI.deleteCustomer(c.id);
      if (selectedCustomerId === c.id) {
        setSelectedCustomerId(null);
        setCustomerTrips([]);
      }
      await loadCustomers(customerSearch.trim() || undefined);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete customer');
    }
  };

  const openCustomerTrips = async (c: OrgCustomer) => {
    setSelectedCustomerId(c.id);
    setCustomerBusy('Loading rides…');
    try {
      const res = await orgAPI.getCustomerTrips(c.id);
      setCustomerTrips(res.data || []);
    } catch {
      setCustomerTrips([]);
    } finally {
      setCustomerBusy('');
    }
  };

  const handleUpdateOrg = async (data: { name?: string; plan?: string }) => {
    try {
      await orgAPI.updateOrg(data);
      loadOrg();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleSaveFareSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await orgAPI.updateFareSettings(fareForm);
      setFareSaved('Saved');
      loadOrg();
      setTimeout(() => setFareSaved(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save fare settings');
    }
  };

  const handleToggleBooking = async (enabled: boolean) => {
    setBookingBusy(enabled ? 'Enabling…' : 'Disabling…');
    try {
      const next = { ...fareForm, bookingEnabled: enabled };
      setFareForm(next);
      await orgAPI.updateFareSettings(next);
      await loadOrg();
      setBookingBusy(enabled ? 'Booking enabled' : 'Booking disabled');
      setTimeout(() => setBookingBusy(''), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update booking');
      setBookingBusy('');
    }
  };

  const handleCopyBookingLink = async () => {
    if (!org) return;
    const url = `${window.location.origin}/book/${org.subdomain}`;
    try {
      await navigator.clipboard.writeText(url);
      setBookingCopied(true);
      setTimeout(() => setBookingCopied(false), 2000);
    } catch {
      alert('Could not copy link');
    }
  };

  const handleSaveBookingFare = async () => {
    setBookingBusy('Saving fare…');
    try {
      await orgAPI.updateFareSettings(fareForm);
      await loadOrg();
      setBookingBusy('Fare saved');
      setTimeout(() => setBookingBusy(''), 2000);
    } catch (err: any) {
      setBookingBusy(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleLogout = () => {
    logout();
    clearOrgContext();
    navigate('/org/signin');
  };

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMoreOpen(false);
    if (tab === 'taxi') { setOpsFilter('all'); setOpsSearch(''); }
    if (tab === 'zones') loadOrgChannels();
  };
  const activeMoreTab = MORE_TABS.find(t => t.id === activeTab);

  if (loading) {
    return (
      <div className="owner-portal-loading">
        <BrandMark size={56} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="owner-portal-loading">
        <p>Organization not found</p>
        <button onClick={() => navigate('/org/signin')}>Back to sign in</button>
      </div>
    );
  }

  const onlineDrivers = members.filter(m => m.user.isOnline).length;
  const availableDrivers = locations.filter(l => l.status === 'available').length;
  const busyDrivers = locations.filter(l => l.status === 'busy').length;
  // Kilo Taxi focus: treat all live ops as taxi rides (delivery UI deferred)
  const taxiTrips = activeTrips.filter((t: { serviceType?: string }) => t.serviceType !== 'delivery');
  const liveTaxi = taxiTrips.filter(isLiveTrip);
  const taxiRequests = taxiTrips.filter((t: { status: string }) => t.status === 'requested');
  const assignedRides = taxiTrips.filter((t: { status: string }) => t.status === 'assigned');
  const enRouteRides = taxiTrips.filter((t: { status: string }) => t.status === 'en_route' || t.status === 'arrived');
  const completedRides = taxiTrips.filter((t: { status: string }) => t.status === 'completed');
  const liveFareTotal = liveTaxi.reduce((sum: number, t: { estimatedFare?: number }) => sum + (t.estimatedFare || 0), 0);
  const completedFareTotal = completedRides.reduce((sum: number, t: { estimatedFare?: number; actualFare?: number }) => sum + (t.actualFare || t.estimatedFare || 0), 0);
  const driverCards = driverRoster
    .map((item) => {
      const m = item.membership;
      const liveLoc = locations.find(l => l.userId === m.userId);
      const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username;
      return {
        ...item,
        displayName: name,
        liveLoc,
        userId: m.userId,
        user: m.user,
        role: m.role,
        id: m.id,
      };
    })
    .filter((m) => {
      const q = driverSearch.trim().toLowerCase();
      if (!q) return true;
      return [
        m.displayName,
        m.user.phone,
        m.liveLoc?.status,
        m.profile?.vehiclePlate,
        m.user.username,
      ].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  const selectedDriver = driverCards.find(d => d.userId === selectedDriverId) || null;
  const topDrivers = [...driverCards]
    .sort((a, b) => (b.completedTrips || 0) - (a.completedTrips || 0))
    .slice(0, 8);
  const staffMembers = members.filter(m => m.role !== 'driver');
  const staffOwners = staffMembers.filter(m => m.role === 'owner');
  const staffAdmins = staffMembers.filter(m => m.role === 'admin');
  const staffDispatchers = staffMembers.filter(m => m.role === 'dispatcher');
  const staffOnline = staffMembers.filter(m => m.user.isOnline).length;
  const filteredStaff = staffMembers
    .filter(m => staffRoleFilter === 'all' ? true : m.role === staffRoleFilter)
    .filter(m => {
      const q = staffSearch.trim().toLowerCase();
      if (!q) return true;
      const name = `${m.user.firstName || ''} ${m.user.lastName || ''} ${m.user.username} ${m.user.phone}`.toLowerCase();
      return name.includes(q);
    });
  const customersWithTrips = customers.filter(c => c.tripCount > 0).length;
  const repeatCustomers = customers.filter(c => c.tripCount > 1).length;
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const walletTotal = driverCards.reduce((sum, d) => sum + (d.wallet?.balanceMmk || 0), 0);
  const lowBalanceDrivers = driverCards.filter(d => (d.wallet?.balanceMmk ?? 0) < 5000);
  const walletAvg = driverCards.length
    ? Math.round(walletTotal / driverCards.length)
    : 0;
  const filteredWallets = driverCards
    .filter(d => {
      const q = walletSearch.trim().toLowerCase();
      if (!q) return true;
      return [d.displayName, d.user.phone, d.profile?.vehiclePlate]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    })
    .sort((a, b) => (a.wallet?.balanceMmk ?? 0) - (b.wallet?.balanceMmk ?? 0));
  const filteredAlerts = recentAlerts.filter(a =>
    alertFilter === 'all' ? true : a.eventType === alertFilter
  );
  const alertEnterCount = recentAlerts.filter(a => a.eventType === 'enter').length;
  const alertExitCount = recentAlerts.filter(a => a.eventType === 'exit').length;
  const bookingUrl = org ? `${window.location.origin}/book/${org.subdomain}` : '';
  const bookingPreviewFare = org
    ? Math.max(org.fareMinimum ?? 0, Math.round(bookingKm * (org.fareRatePerKm ?? 0)))
    : 0;
  const offlineDriversForMap = driverCards.filter(d => !locations.some(l => l.userId === d.userId));
  const offlineMapRows = offlineDriversForMap.filter(d => {
    if (!mapSearch.trim()) return true;
    const q = mapSearch.toLowerCase();
    return [d.displayName, d.user.phone, d.profile?.vehiclePlate]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  }).map(d => ({
    userId: d.userId,
    displayName: d.displayName,
    phone: d.user.phone,
    plate: d.profile?.vehiclePlate || '',
    status: 'offline',
    speed: 0,
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    online: false,
  }));
  const liveMapRows = mapStatusFilter === 'offline'
    ? []
    : filteredLocations.map(loc => {
        const card = driverCards.find(d => d.userId === loc.userId);
        return {
          userId: loc.userId,
          displayName: `${loc.user?.firstName || ''} ${loc.user?.lastName || ''}`.trim() || loc.user?.username || card?.displayName || 'Driver',
          phone: card?.user.phone || '',
          plate: card?.profile?.vehiclePlate || '',
          status: loc.status,
          speed: loc.speed || 0,
          lat: loc.latitude as number | undefined,
          lng: loc.longitude as number | undefined,
          online: true,
        };
      });
  const showOfflineRows = mapStatusFilter === 'all' || mapStatusFilter === 'offline';
  const mapListDrivers = showOfflineRows ? [...liveMapRows, ...offlineMapRows] : liveMapRows;
  const firstOfflineIndex = liveMapRows.length;
  const filteredChannels = channels.filter(ch => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return true;
    return [ch.name, ch.description].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });
  const userInitial = (user?.firstName || user?.username || 'A').charAt(0).toUpperCase();

  const filterJobs = (list: any[]) => list.filter((t: {
    status: string;
    customerName?: string;
    customerPhone?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
  }) => {
    if (opsFilter === 'done') {
      if (t.status !== 'completed') return false;
    } else if (opsFilter === 'cancelled') {
      if (t.status !== 'cancelled') return false;
    } else if (opsFilter !== 'all' && t.status !== opsFilter) {
      return false;
    } else if (opsFilter === 'all' && ['completed', 'cancelled'].includes(t.status)) {
      return false;
    }
    const q = opsSearch.trim().toLowerCase();
    if (!q) return true;
    return [t.customerName, t.customerPhone, t.pickupAddress, t.dropoffAddress]
      .filter(Boolean)
      .some(s => String(s).toLowerCase().includes(q));
  });

  const handleCancelTrip = async (tripId: string, customerName: string) => {
    if (!window.confirm(`Cancel ride for ${customerName}?`)) return;
    try {
      await orgAPI.updateTrip(tripId, { status: 'cancelled' });
      await loadOperations();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel ride');
    }
  };

  const canCancelTrip = (status: string) =>
    !['completed', 'cancelled'].includes(status);

  const driverLabel = (t: { driverId?: string; driver?: { firstName?: string; lastName?: string; username?: string } }) => {
    if (t.driver) {
      const name = `${t.driver.firstName || ''} ${t.driver.lastName || ''}`.trim();
      return name || t.driver.username || '—';
    }
    if (!t.driverId) return 'Unassigned';
    const match = members.find(m => m.userId === t.driverId);
    if (!match) return 'Assigned';
    return `${match.user.firstName || ''} ${match.user.lastName || ''}`.trim() || match.user.username;
  };

  const renderJobBoard = (opts: {
    title: string;
    subtitle: string;
    liveCount: number;
    jobs: any[];
  }) => {
    const filtered = filterJobs(opts.jobs);
    const cancelledCount = opts.jobs.filter((t: { status: string }) => t.status === 'cancelled').length;
    const completedCount = opts.jobs.filter((t: { status: string }) => t.status === 'completed').length;
    return (
      <div className="owner-tab-content owner-full">
        <div className="owner-page-head">
          <div>
            <h1>{opts.title}</h1>
            <p className="owner-ops-subtitle">{opts.subtitle}</p>
          </div>
          <div className="owner-ops-actions">
            <button type="button" className="owner-secondary-btn" onClick={() => loadOperations()}>Refresh</button>
            <button type="button" className="owner-primary-btn" onClick={() => navigate('/dispatch')}>+ Dispatch</button>
          </div>
        </div>

        <div className="owner-ops-filters">
          {([
            { id: 'all' as const, label: `Live (${opts.liveCount})` },
            { id: 'requested' as const, label: 'Requested' },
            { id: 'assigned' as const, label: 'Assigned' },
            { id: 'en_route' as const, label: 'En route' },
            { id: 'arrived' as const, label: 'Arrived' },
            { id: 'done' as const, label: `Done (${completedCount})` },
            { id: 'cancelled' as const, label: `Cancelled (${cancelledCount})` },
          ]).map(f => (
            <button
              key={f.id}
              type="button"
              className={`owner-ops-pill ${opsFilter === f.id ? 'active' : ''}`}
              onClick={() => setOpsFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="owner-ops-search">
          <input
            type="search"
            placeholder="Search customer, phone, or address…"
            value={opsSearch}
            onChange={e => setOpsSearch(e.target.value)}
          />
        </div>

        <div className="owner-panel owner-rides-panel">
          <div className="owner-panel-body">
            {filtered.length === 0 ? (
              <div className="owner-panel-empty">No rides yet. Create from Dispatch or wait for customer booking.</div>
            ) : (
              <table className="owner-table owner-rides-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th className="num">Fare</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t: {
                    id: string;
                    customerName: string;
                    pickupAddress: string;
                    dropoffAddress: string;
                    status: string;
                    customerPhone?: string;
                    estimatedFare?: number;
                    actualFare?: number;
                    distanceKm?: number;
                    bookingSource?: string;
                    driverId?: string;
                    driver?: { firstName?: string; lastName?: string; username?: string };
                    createdAt?: string;
                  }, i: number) => (
                    <tr key={t.id} className={t.status === 'requested' ? 'row-alert' : ''}>
                      <td>{i + 1}</td>
                      <td>
                        <span className="owner-table-title">{t.customerName}</span>
                        <span className="owner-table-sub">
                          {t.customerPhone || '—'}
                          {t.bookingSource === 'customer' ? ' · App' : t.bookingSource ? ` · ${t.bookingSource}` : ''}
                        </span>
                      </td>
                      <td>
                        <span className="owner-table-title owner-route-line">{t.pickupAddress}</span>
                        <span className="owner-table-sub">→ {t.dropoffAddress}</span>
                      </td>
                      <td>{driverLabel(t)}</td>
                      <td>
                        <span className={`owner-ops-status-pill status-${t.status}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="num">
                        <span className="owner-table-title">
                          {(t.actualFare ?? t.estimatedFare ?? 0).toLocaleString()}
                        </span>
                        <span className="owner-table-sub">
                          {t.distanceKm != null ? `${t.distanceKm} km` : 'MMK'}
                        </span>
                      </td>
                      <td className="num">
                        <div className="owner-table-actions">
                          <button type="button" className="owner-secondary-btn" onClick={() => navigate('/dispatch')}>
                            Dispatch
                          </button>
                          {canCancelTrip(t.status) && (
                            <button
                              type="button"
                              className="owner-remove-btn"
                              onClick={() => handleCancelTrip(t.id, t.customerName)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const MetricIcon = ({ children, brand }: { children: React.ReactNode; brand?: boolean }) => (
    <div className={`owner-metric-icon${brand ? ' brand' : ''}`}>{children}</div>
  );

  return (
    <div className="owner-portal">
      <header className="owner-topbar">
        <div className="owner-topbar-brand" title={`${org.subdomain}.farepro.app`}>
          <BrandMark size={32} />
          <strong>{org.name}</strong>
          <span className={`owner-plan-badge ${org.plan}`}>{org.plan}</span>
        </div>
        <nav className="owner-topnav" aria-label="Stand sections">
          {PRIMARY_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={activeTab === t.id ? 'active' : ''}
              aria-current={activeTab === t.id ? 'page' : undefined}
              onClick={() => selectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="owner-more" ref={moreMenuRef}>
            <button
              type="button"
              className={activeMoreTab ? 'active' : ''}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(o => !o)}
            >
              {activeMoreTab ? activeMoreTab.label : 'More'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {moreOpen && (
              <div className="owner-more-menu" role="menu">
                {MORE_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    className={activeTab === t.id ? 'active' : ''}
                    onClick={() => selectTab(t.id)}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="owner-topbar-right">
          <button type="button" className="owner-topbar-new" onClick={() => navigate('/dispatch')}>
            + New ride
          </button>
          <button
            type="button"
            className={`owner-topbar-user${activeTab === 'profile' ? ' active' : ''}`}
            onClick={() => setActiveTab('profile')}
            title="Profile & settings"
          >
            <span className="owner-topbar-avatar">{userInitial}</span>
            <em>Profile</em>
          </button>
          <button type="button" className="owner-topbar-iconbtn" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="owner-main">
        {activeTab === 'dashboard' && (
          <div className="owner-tab-content owner-full owner-dashboard">
            <div className="owner-page-head">
              <div>
                <h1>Taxi Dashboard</h1>
                <p className="owner-ops-subtitle">Rides · drivers · map · alerts</p>
              </div>
              <div className="owner-ops-actions">
                <button type="button" className="owner-secondary-btn" onClick={() => { loadOrg(); loadOperations(); loadMembers(); }}>
                  Refresh
                </button>
                <button type="button" className="owner-primary-btn" onClick={() => { setActiveTab('taxi'); setOpsFilter('all'); }}>
                  Rides →
                </button>
              </div>
            </div>

            <div className="owner-metric-grid">
              <div className="owner-metric-card">
                <MetricIcon brand>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Live fare</span>
                  <span className="owner-metric-value">{liveFareTotal.toLocaleString()}</span>
                  <span className="owner-metric-sub">{liveTaxi.length} active</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Rides today</span>
                  <span className="owner-metric-value">{taxiTrips.length}</span>
                  <span className="owner-metric-sub">{completedFareTotal.toLocaleString()} MMK done</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Drivers</span>
                  <span className="owner-metric-value">{driverCards.length}</span>
                  <span className="owner-metric-sub">{availableDrivers} available · {onlineDrivers} online</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">On map</span>
                  <span className="owner-metric-value">{locations.length}</span>
                  <span className="owner-metric-sub">{busyDrivers} busy</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon brand>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Requested</span>
                  <span className="owner-metric-value">{taxiRequests.length}</span>
                  <span className="owner-metric-sub">Awaiting assign</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Assigned</span>
                  <span className="owner-metric-value">{assignedRides.length}</span>
                  <span className="owner-metric-sub">Driver matched</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">En route</span>
                  <span className="owner-metric-value">{enRouteRides.length}</span>
                  <span className="owner-metric-sub">Pickup / dropoff</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <MetricIcon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </MetricIcon>
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Completed</span>
                  <span className="owner-metric-value">{completedRides.length}</span>
                  <span className="owner-metric-sub">{completedFareTotal.toLocaleString()} MMK</span>
                </div>
              </div>
            </div>

            <div className="owner-split">
              <section className="owner-panel">
                <div className="owner-panel-head">
                  <h2>Active rides</h2>
                </div>
                <div className="owner-panel-body">
                  {liveTaxi.length === 0 ? (
                    <div className="owner-panel-empty">No active rides yet.</div>
                  ) : (
                    <table className="owner-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th className="num">Fare</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveTaxi.map((t: {
                          id: string;
                          customerName: string;
                          customerPhone?: string;
                          pickupAddress?: string;
                          status: string;
                          estimatedFare?: number;
                        }, i: number) => (
                          <tr key={t.id}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{t.customerName}</span>
                              <span className="owner-table-sub">{t.pickupAddress || t.customerPhone || '—'}</span>
                            </td>
                            <td><span className={`owner-ops-status-pill status-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                            <td className="num">{(t.estimatedFare || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="owner-panel">
                <div className="owner-panel-head">
                  <h2>Top drivers</h2>
                </div>
                <div className="owner-panel-body">
                  {topDrivers.length === 0 ? (
                    <div className="owner-panel-empty">No drivers yet.</div>
                  ) : (
                    <table className="owner-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Driver</th>
                          <th className="num">Done</th>
                          <th className="num">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDrivers.map((d, i) => (
                          <tr key={d.id}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{d.displayName}</span>
                              <span className="owner-table-sub">{d.profile?.vehiclePlate || d.user.phone || '—'}</span>
                            </td>
                            <td className="num">{d.completedTrips ?? 0}</td>
                            <td className="num">{d.activeTrips ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'taxi' && renderJobBoard({
          title: 'Rides',
          subtitle: `${liveTaxi.length} active · Kilo Taxi passenger rides`,
          liveCount: liveTaxi.length,
          jobs: taxiTrips,
        })}

        {activeTab === 'team' && (
          <div className="owner-tab-content owner-full owner-team-page">
            <div className="owner-page-head">
              <div>
                <h1>Team</h1>
                <p className="owner-ops-subtitle">
                  Staff access · {staffMembers.length} people · drivers stay on Drivers
                </p>
              </div>
              <div className="owner-ops-actions">
                <button type="button" className="owner-secondary-btn" onClick={() => loadMembers()}>
                  Refresh
                </button>
                <button
                  type="button"
                  className="owner-primary-btn"
                  onClick={() => {
                    setInviteForm(f => ({ ...f, role: 'dispatcher' }));
                    setInviteError('');
                    setInviteSuccess('');
                    setShowInviteModal(true);
                  }}
                >
                  + Add staff
                </button>
              </div>
            </div>

            <div className="owner-metric-grid owner-team-metrics">
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Owners</span>
                <strong className="owner-metric-value">{staffOwners.length}</strong>
                <span className="owner-metric-sub">Full control</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Admins</span>
                <strong className="owner-metric-value">{staffAdmins.length}</strong>
                <span className="owner-metric-sub">Portal + settings</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Dispatchers</span>
                <strong className="owner-metric-value">{staffDispatchers.length}</strong>
                <span className="owner-metric-sub">Dispatch console</span>
              </div>
              <div className="owner-metric-card owner-metric-stack owner-metric-ok">
                <span className="owner-metric-label">Online</span>
                <strong className="owner-metric-value">{staffOnline}</strong>
                <span className="owner-metric-sub">Staff online now</span>
              </div>
            </div>

            <div className="owner-team-workspace">
              <div className="owner-team-main">
                <div className="owner-ops-filters">
                  {([
                    { id: 'all' as const, label: `All (${staffMembers.length})` },
                    { id: 'owner' as const, label: `Owner (${staffOwners.length})` },
                    { id: 'admin' as const, label: `Admin (${staffAdmins.length})` },
                    { id: 'dispatcher' as const, label: `Dispatcher (${staffDispatchers.length})` },
                  ]).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className={`owner-ops-pill ${staffRoleFilter === f.id ? 'active' : ''}`}
                      onClick={() => setStaffRoleFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="owner-ops-search owner-ops-search-icon">
                  <SearchIcon size={16} />
                  <input
                    type="search"
                    placeholder="Search staff by name or phone…"
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                  />
                </div>

                <div className="owner-panel owner-rides-panel">
                  <div className="owner-panel-body">
                    {filteredStaff.length === 0 ? (
                      <div className="owner-panel-empty owner-empty-rich">
                        <UsersIcon size={36} />
                        <p>No staff in this filter</p>
                        <span>Add a dispatcher for ride assign, or an admin for portal access.</span>
                        <button
                          type="button"
                          className="owner-primary-btn"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            setInviteForm(f => ({ ...f, role: 'dispatcher' }));
                            setShowInviteModal(true);
                          }}
                        >
                          + Add staff
                        </button>
                      </div>
                    ) : (
                      <table className="owner-table owner-rides-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Access</th>
                            <th>Status</th>
                            <th className="num">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStaff.map((m, i) => {
                            const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username;
                            const access =
                              m.role === 'owner' ? 'Portal · Dispatch · Billing'
                                : m.role === 'admin' ? 'Portal · Dispatch · Team'
                                  : 'Dispatch · Assign rides';
                            const canEdit = m.role !== 'owner' && (orgRole === 'owner' || (orgRole === 'admin' && m.role !== 'admin'));
                            return (
                              <tr key={m.id}>
                                <td>{i + 1}</td>
                                <td>
                                  <span className="owner-table-title">{name}</span>
                                  <span className="owner-table-sub">{m.user.phone || m.user.username}</span>
                                </td>
                                <td>
                                  {canEdit ? (
                                    <select
                                      className="owner-inline-select"
                                      value={m.role}
                                      disabled={staffBusyId === m.userId}
                                      onChange={e => handleChangeStaffRole(m.userId, e.target.value, name)}
                                    >
                                      <option value="dispatcher">dispatcher</option>
                                      <option value="admin">admin</option>
                                      <option value="driver">driver</option>
                                    </select>
                                  ) : (
                                    <span className={`owner-member-role ${m.role}`}>{m.role}</span>
                                  )}
                                </td>
                                <td>
                                  <span className="owner-table-sub owner-team-access">{access}</span>
                                </td>
                                <td>
                                  <span className={`owner-online-badge ${m.user.isOnline ? 'online' : 'offline'}`}>
                                    {m.user.isOnline ? 'Online' : 'Offline'}
                                  </span>
                                </td>
                                <td className="num">
                                  <div className="owner-table-actions">
                                    {m.role === 'dispatcher' && (
                                      <button type="button" className="owner-secondary-btn" onClick={() => navigate('/dispatch')}>
                                        Dispatch
                                      </button>
                                    )}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        className="owner-remove-btn"
                                        onClick={() => handleRemoveMember(m.userId, name)}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <aside className="owner-team-guide">
                <div className="owner-panel">
                  <div className="owner-panel-head">
                    <h3>Role guide</h3>
                  </div>
                  <div className="owner-panel-body owner-team-guide-body">
                    <div className="owner-team-role-card">
                      <span className="owner-member-role owner">owner</span>
                      <p>Full org control, billing, fare, team, and delete rights.</p>
                    </div>
                    <div className="owner-team-role-card">
                      <span className="owner-member-role admin">admin</span>
                      <p>Portal ops, channels, wallets, booking settings, staff invite.</p>
                    </div>
                    <div className="owner-team-role-card">
                      <span className="owner-member-role dispatcher">dispatcher</span>
                      <p>Dispatch console only — create/assign rides and radio.</p>
                    </div>
                    <div className="owner-team-role-card muted">
                      <span className="owner-member-role driver">driver</span>
                      <p>Managed on Drivers page — jobs, PTT, wallet, map.</p>
                      <button type="button" className="owner-secondary-btn" onClick={() => setActiveTab('drivers')}>
                        Open Drivers →
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="owner-tab-content owner-full owner-team-page">
            <div className="owner-page-head">
              <div>
                <h1>Customers</h1>
                <p className="owner-ops-subtitle">
                  Riders · {customers.length} saved · auto-created from booking &amp; dispatch
                </p>
              </div>
              <div className="owner-ops-actions">
                <button type="button" className="owner-secondary-btn" onClick={() => loadCustomers(customerSearch.trim() || undefined)}>
                  Refresh
                </button>
                <button type="button" className="owner-primary-btn" onClick={openCreateCustomer}>
                  + Add customer
                </button>
              </div>
            </div>

            <div className="owner-metric-grid owner-team-metrics">
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Total</span>
                <strong className="owner-metric-value">{customers.length}</strong>
                <span className="owner-metric-sub">In CRM</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">With rides</span>
                <strong className="owner-metric-value">{customersWithTrips}</strong>
                <span className="owner-metric-sub">At least 1 trip</span>
              </div>
              <div className="owner-metric-card owner-metric-stack owner-metric-ok">
                <span className="owner-metric-label">Repeat</span>
                <strong className="owner-metric-value">{repeatCustomers}</strong>
                <span className="owner-metric-sub">2+ rides</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Selected</span>
                <strong className="owner-metric-value">{selectedCustomer ? selectedCustomer.tripCount : '—'}</strong>
                <span className="owner-metric-sub">{selectedCustomer ? selectedCustomer.name : 'Pick a rider'}</span>
              </div>
            </div>

            <div className="owner-team-workspace">
              <div className="owner-team-main">
                <div className="owner-ops-search owner-ops-search-icon">
                  <SearchIcon size={16} />
                  <input
                    type="search"
                    placeholder="Search by name, phone, or notes…"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                </div>

                <div className="owner-panel owner-rides-panel">
                  <div className="owner-panel-body">
                    {customers.length === 0 ? (
                      <div className="owner-panel-empty owner-empty-rich">
                        <UsersIcon size={36} />
                        <p>No customers yet</p>
                        <span>Add manually, or they appear when someone books or dispatch creates a ride.</span>
                        <button type="button" className="owner-primary-btn" style={{ marginTop: 8 }} onClick={openCreateCustomer}>
                          + Add customer
                        </button>
                      </div>
                    ) : (
                      <table className="owner-table owner-rides-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th className="num">Rides</th>
                            <th>Last ride</th>
                            <th className="num">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customers.map((c, i) => (
                            <tr key={c.id} className={selectedCustomerId === c.id ? 'row-alert' : ''}>
                              <td>{i + 1}</td>
                              <td>
                                <span className="owner-table-title">{c.name}</span>
                                {c.notes ? <span className="owner-table-sub">{c.notes}</span> : null}
                              </td>
                              <td>{c.phone}</td>
                              <td className="num">{c.tripCount}</td>
                              <td>
                                <span className="owner-table-sub">
                                  {c.lastTripAt ? new Date(c.lastTripAt).toLocaleString() : '—'}
                                </span>
                              </td>
                              <td className="num">
                                <div className="owner-table-actions">
                                  <button type="button" className="owner-secondary-btn" onClick={() => openCustomerTrips(c)}>
                                    History
                                  </button>
                                  <button type="button" className="owner-secondary-btn" onClick={() => openEditCustomer(c)}>
                                    Edit
                                  </button>
                                  <button type="button" className="owner-remove-btn" onClick={() => handleDeleteCustomer(c)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <aside className="owner-team-guide">
                <div className="owner-panel">
                  <div className="owner-panel-head">
                    <h3>{selectedCustomer ? selectedCustomer.name : 'Ride history'}</h3>
                  </div>
                  <div className="owner-panel-body owner-team-guide-body">
                    {!selectedCustomer ? (
                      <p className="owner-ops-subtitle">Select History on a customer to see their rides.</p>
                    ) : (
                      <>
                        <p className="owner-ops-subtitle">
                          {selectedCustomer.phone}
                          {selectedCustomer.notes ? ` · ${selectedCustomer.notes}` : ''}
                        </p>
                        {customerBusy === 'Loading rides…' && <p className="owner-ops-subtitle">Loading…</p>}
                        {customerTrips.length === 0 && customerBusy !== 'Loading rides…' ? (
                          <p className="owner-ops-subtitle">No linked rides yet.</p>
                        ) : (
                          <ul className="owner-customer-trip-list">
                            {customerTrips.map((t: {
                              id: string;
                              pickupAddress?: string;
                              dropoffAddress?: string;
                              status: string;
                              estimatedFare?: number;
                              actualFare?: number;
                              createdAt?: string;
                            }) => (
                              <li key={t.id}>
                                <span className={`owner-ops-status-pill status-${t.status}`}>
                                  {t.status.replace('_', ' ')}
                                </span>
                                <strong>
                                  {(t.actualFare ?? t.estimatedFare ?? 0).toLocaleString()} MMK
                                </strong>
                                <span className="owner-table-sub">
                                  {t.pickupAddress || '—'} → {t.dropoffAddress || '—'}
                                </span>
                                <span className="owner-table-sub">
                                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>Daily report</h1>
                <p className="owner-ops-subtitle">Taxi rides · completed fare · driver settlement</p>
              </div>
              <div className="owner-ops-actions">
                <input
                  type="date"
                  className="owner-date-input"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                />
                <button type="button" className="owner-secondary-btn" onClick={() => loadDailyReport(reportDate)} disabled={reportBusy}>
                  {reportBusy ? 'Loading…' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="owner-metric-grid owner-team-metrics">
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Trips</span>
                <strong className="owner-metric-value">{dailyReport?.totalTrips ?? '—'}</strong>
                <span className="owner-metric-sub">{dailyReport?.date || reportDate}</span>
              </div>
              <div className="owner-metric-card owner-metric-stack owner-metric-ok">
                <span className="owner-metric-label">Completed</span>
                <strong className="owner-metric-value">{dailyReport?.completed ?? '—'}</strong>
                <span className="owner-metric-sub">{(dailyReport?.fareTotal ?? 0).toLocaleString()} MMK</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Active</span>
                <strong className="owner-metric-value">{dailyReport?.active ?? '—'}</strong>
                <span className="owner-metric-sub">{dailyReport?.requested ?? 0} requested</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Cancelled</span>
                <strong className="owner-metric-value">{dailyReport?.cancelled ?? '—'}</strong>
                <span className="owner-metric-sub">Same day</span>
              </div>
            </div>

            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-head">
                <h3>Driver settlement</h3>
              </div>
              <div className="owner-panel-body">
                {!dailyReport || dailyReport.drivers.length === 0 ? (
                  <div className="owner-panel-empty owner-empty-rich">
                    <p>No completed rides for this day</p>
                    <span>Pick another date, or complete rides to see fare per driver.</span>
                  </div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Driver</th>
                        <th className="num">Rides</th>
                        <th className="num">Fare</th>
                        <th className="num">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReport.drivers.map((d, i) => {
                        const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.username;
                        return (
                          <tr key={d.driverId}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{name}</span>
                            </td>
                            <td className="num">{d.completedTrips}</td>
                            <td className="num">{d.fareTotal.toLocaleString()}</td>
                            <td className="num">{d.walletBalance.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>Alerts</h1>
                <p className="owner-ops-subtitle">Geofence enter / exit · live operational signals</p>
              </div>
              <button type="button" className="owner-secondary-btn" onClick={() => loadOperations()}>
                <RefreshCwIcon size={14} /> Refresh
              </button>
            </div>

            <div className="owner-metric-grid owner-ops-metrics-3">
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Total</span>
                <strong className="owner-metric-value">{recentAlerts.length}</strong>
                <span className="owner-metric-sub">Last 50 events</span>
              </div>
              <div className="owner-metric-card owner-metric-stack owner-metric-ok">
                <span className="owner-metric-label">Enter</span>
                <strong className="owner-metric-value">{alertEnterCount}</strong>
                <span className="owner-metric-sub">Zone arrivals</span>
              </div>
              <div className="owner-metric-card owner-metric-stack owner-metric-warn">
                <span className="owner-metric-label">Exit</span>
                <strong className="owner-metric-value">{alertExitCount}</strong>
                <span className="owner-metric-sub">Zone departures</span>
              </div>
            </div>

            <div className="owner-ops-filters">
              {([
                { id: 'all' as const, label: 'All' },
                { id: 'enter' as const, label: 'Enter' },
                { id: 'exit' as const, label: 'Exit' },
              ]).map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`owner-ops-pill ${alertFilter === f.id ? 'active' : ''}`}
                  onClick={() => setAlertFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-body">
                {filteredAlerts.length === 0 ? (
                  <div className="owner-panel-empty owner-empty-rich">
                    <AlertIcon size={36} />
                    <p>No geofence alerts yet</p>
                    <span>Alerts appear when drivers enter or leave zones you configured on the map.</span>
                  </div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Event</th>
                        <th>Driver</th>
                        <th>Zone</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((a: {
                        id: string;
                        eventType: string;
                        userId?: string;
                        createdAt?: string;
                        latitude?: number;
                        longitude?: number;
                        zone?: { name: string };
                        user?: { firstName: string; username: string };
                      }) => {
                        const driverName = a.user?.firstName || a.user?.username || 'Driver';
                        const when = a.createdAt
                          ? new Date(a.createdAt).toLocaleString([], {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })
                          : '—';
                        return (
                          <tr key={a.id}>
                            <td>
                              <span className="owner-table-title">{when}</span>
                            </td>
                            <td>
                              <span className={`owner-alert-chip ${a.eventType}`}>
                                {a.eventType === 'enter' ? 'Enter' : 'Exit'}
                              </span>
                            </td>
                            <td>{driverName}</td>
                            <td>{a.zone?.name || 'Zone'}</td>
                            <td className="num">
                              <div className="owner-table-actions">
                                <button
                                  type="button"
                                  className="owner-secondary-btn"
                                  onClick={() => {
                                    if (a.userId) setMapFocusUserId(a.userId);
                                    setActiveTab('map');
                                  }}
                                >
                                  Map
                                </button>
                                {a.userId && (
                                  <button
                                    type="button"
                                    className="owner-primary-btn owner-ptt-btn"
                                    disabled={driverPttBusy === a.userId}
                                    onClick={() => handleDriverPTT(a.userId!, driverName)}
                                    title="1:1 PTT with driver"
                                  >
                                    <MicIcon size={14} />
                                    {driverPttBusy === a.userId ? '…' : 'Talk'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'zones' && <GeofenceZonesTab channels={channels} />}

        {activeTab === 'wallets' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>Wallets</h1>
                <p className="owner-ops-subtitle">Driver float · top-up · settle</p>
              </div>
              <button type="button" className="owner-secondary-btn" onClick={() => loadMembers()}>
                <RefreshCwIcon size={14} /> Refresh
              </button>
            </div>

            <div className="owner-metric-grid owner-ops-metrics-3">
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Fleet total</span>
                <strong className="owner-metric-value">{walletTotal.toLocaleString()}</strong>
                <span className="owner-metric-sub">MMK across {driverCards.length} drivers</span>
              </div>
              <div className="owner-metric-card owner-metric-stack">
                <span className="owner-metric-label">Average</span>
                <strong className="owner-metric-value">{walletAvg.toLocaleString()}</strong>
                <span className="owner-metric-sub">MMK per driver</span>
              </div>
              <div className={`owner-metric-card owner-metric-stack ${lowBalanceDrivers.length ? 'owner-metric-warn' : 'owner-metric-ok'}`}>
                <span className="owner-metric-label">Low balance</span>
                <strong className="owner-metric-value">{lowBalanceDrivers.length}</strong>
                <span className="owner-metric-sub">Under 5,000 MMK</span>
              </div>
            </div>

            <TopupRequestsPanel onReviewed={() => loadMembers()} />

            <div className="owner-ops-search owner-ops-search-icon">
              <SearchIcon size={16} />
              <input
                type="search"
                placeholder="Search driver, phone, or plate…"
                value={walletSearch}
                onChange={e => setWalletSearch(e.target.value)}
              />
            </div>

            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-body">
                {filteredWallets.length === 0 ? (
                  <div className="owner-panel-empty owner-empty-rich">
                    <UsersIcon size={36} />
                    <p>No driver wallets</p>
                    <span>Add drivers first, then credit their wallet for cash / app rides.</span>
                  </div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Driver</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th className="num">Balance</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWallets.map((d, i) => {
                        const bal = d.wallet?.balanceMmk ?? 0;
                        const low = bal < 5000;
                        return (
                          <tr key={d.id} className={low ? 'owner-row-warn' : ''}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{d.displayName}</span>
                              <span className="owner-table-sub">{d.user.phone}</span>
                            </td>
                            <td>{d.profile?.vehiclePlate || '—'}</td>
                            <td>
                              <span className={`owner-online-badge ${d.user.isOnline ? 'online' : 'offline'}`}>
                                {d.user.isOnline ? 'Online' : 'Offline'}
                              </span>
                              {low && <span className="owner-table-sub" style={{ marginTop: 4 }}>Needs top-up</span>}
                            </td>
                            <td className={`num owner-wallet-amount ${low ? 'low' : ''}`}>
                              {bal.toLocaleString()} MMK
                            </td>
                            <td className="num">
                              <div className="owner-table-actions">
                                <button
                                  type="button"
                                  className="owner-primary-btn"
                                  onClick={() => openDriverDetail(d.userId, d)}
                                >
                                  Adjust
                                </button>
                                <button
                                  type="button"
                                  className="owner-secondary-btn owner-ptt-btn"
                                  disabled={driverPttBusy === d.userId}
                                  onClick={() => handleDriverPTT(d.userId, d.displayName)}
                                  title="1:1 PTT"
                                >
                                  <MicIcon size={14} />
                                  Talk
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'booking' && (
          <div className="owner-tab-content owner-full owner-booking-page">
            <div className="owner-page-head">
              <div>
                <h1>Booking</h1>
                <p className="owner-ops-subtitle">Customer link · fare · live preview</p>
              </div>
              <div className="owner-ops-actions">
                {bookingBusy && <span className="owner-save-ok">{bookingBusy}</span>}
                <button type="button" className="owner-secondary-btn" onClick={() => navigate('/dispatch')}>
                  Open Dispatch
                </button>
                <button type="button" className="owner-primary-btn" onClick={handleSaveBookingFare}>
                  Save changes
                </button>
              </div>
            </div>

            <div className="owner-metric-grid owner-booking-metrics">
              <div className="owner-metric-card">
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Status</span>
                  <span className="owner-metric-value owner-booking-status-value">
                    {org.bookingEnabled ? 'Live' : 'Off'}
                  </span>
                  <span className="owner-metric-sub">{org.bookingEnabled ? 'Accepting customer rides' : 'Booking page disabled'}</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Rate / km</span>
                  <span className="owner-metric-value">{(org.fareRatePerKm ?? 0).toLocaleString()}</span>
                  <span className="owner-metric-sub">MMK</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Minimum</span>
                  <span className="owner-metric-value">{(org.fareMinimum ?? 0).toLocaleString()}</span>
                  <span className="owner-metric-sub">MMK floor</span>
                </div>
              </div>
              <div className="owner-metric-card">
                <div className="owner-metric-body">
                  <span className="owner-metric-label">Night</span>
                  <span className="owner-metric-value">×{(org.fareNightMultiplier ?? 1).toFixed(1)}</span>
                  <span className="owner-metric-sub">
                    {(org.fareNightStart ?? 22)}:00–{(org.fareNightEnd ?? 5)}:00
                  </span>
                </div>
              </div>
            </div>

            <div className="owner-booking-workspace">
              <section className="owner-booking-hero-card">
                <div className="owner-booking-hero-top">
                  <div>
                    <span className="owner-booking-kicker">
                      <LinkIcon size={14} />
                      Public customer page
                    </span>
                    <h2>{org.customerAppTitle || org.name}</h2>
                    <p>Share this link so customers can book a taxi ride.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!org.bookingEnabled}
                    className={`owner-switch${org.bookingEnabled ? ' on' : ''}`}
                    onClick={() => handleToggleBooking(!org.bookingEnabled)}
                  >
                    <span className="owner-switch-knob" />
                    <span className="owner-switch-text">{org.bookingEnabled ? 'Live' : 'Off'}</span>
                  </button>
                </div>
                <div className="owner-booking-link-row">
                  <code title={bookingUrl}>{bookingUrl}</code>
                  <button type="button" className="owner-secondary-btn" onClick={handleCopyBookingLink}>
                    <CopyIcon size={14} />
                    {bookingCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    className="owner-primary-btn"
                    onClick={() => window.open(bookingUrl, '_blank')}
                  >
                    Open page
                  </button>
                </div>
              </section>

              <section className="owner-booking-split">
                <div className="owner-panel owner-booking-panel">
                  <div className="owner-panel-head">
                    <h3>Fare settings</h3>
                  </div>
                  <div className="owner-panel-body owner-booking-fare">
                    <div className="owner-booking-fields">
                      <label className="owner-booking-span-2">
                        App title
                        <input
                          value={fareForm.customerAppTitle}
                          onChange={e => setFareForm(f => ({ ...f, customerAppTitle: e.target.value }))}
                          placeholder={org.name}
                        />
                      </label>
                      <label>
                        Rate / km (MMK)
                        <input
                          type="number"
                          value={fareForm.fareRatePerKm}
                          onChange={e => setFareForm(f => ({ ...f, fareRatePerKm: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        Minimum fare (MMK)
                        <input
                          type="number"
                          value={fareForm.fareMinimum}
                          onChange={e => setFareForm(f => ({ ...f, fareMinimum: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        Night multiplier
                        <input
                          type="number"
                          step="0.1"
                          value={fareForm.fareNightMultiplier}
                          onChange={e => setFareForm(f => ({ ...f, fareNightMultiplier: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        Night start (hour)
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={fareForm.fareNightStart}
                          onChange={e => setFareForm(f => ({ ...f, fareNightStart: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        Night end (hour)
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={fareForm.fareNightEnd}
                          onChange={e => setFareForm(f => ({ ...f, fareNightEnd: Number(e.target.value) }))}
                        />
                      </label>
                    </div>
                    <div className="owner-booking-fare-actions">
                      <button type="button" className="owner-primary-btn" onClick={handleSaveBookingFare}>
                        Save fare
                      </button>
                      <span className="owner-booking-hint">
                        Fare = max(minimum, km × rate). Night multiplies during night hours.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="owner-panel owner-booking-panel owner-booking-preview-panel">
                  <div className="owner-panel-head">
                    <h3>Live preview</h3>
                  </div>
                  <div className="owner-panel-body owner-booking-preview">
                    <label>
                      Trip distance (km)
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={bookingKm}
                        onChange={e => setBookingKm(Number(e.target.value) || 0)}
                      />
                    </label>
                    <div className="owner-booking-preview-result">
                      <div>
                        <span>Day fare</span>
                        <strong>{bookingPreviewFare.toLocaleString()} MMK</strong>
                      </div>
                      <div>
                        <span>Night fare</span>
                        <strong>
                          {Math.round(bookingPreviewFare * (fareForm.fareNightMultiplier || 1)).toLocaleString()} MMK
                        </strong>
                      </div>
                    </div>
                    <div className="owner-booking-preview-meta">
                      <div>
                        <span>Distance</span>
                        <strong>{bookingKm || 0} km</strong>
                      </div>
                      <div>
                        <span>Rate</span>
                        <strong>{(fareForm.fareRatePerKm || 0).toLocaleString()} / km</strong>
                      </div>
                      <div>
                        <span>Night window</span>
                        <strong>{fareForm.fareNightStart}:00–{fareForm.fareNightEnd}:00</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="owner-panel owner-booking-panel owner-dispatch-settings">
                <div className="owner-panel-head">
                  <h3>Dispatch &amp; driver wallets</h3>
                </div>
                <div className="owner-panel-body owner-booking-fare">
                  <label className="owner-settings-toggle">
                    <input
                      type="checkbox"
                      checked={fareForm.autoDispatch}
                      onChange={e => setFareForm(f => ({ ...f, autoDispatch: e.target.checked }))}
                    />
                    <span>
                      <strong>Auto-offer new rides</strong> — offer each new ride to the nearest available driver for 30 s,
                      then the next nearest, until someone accepts.
                    </span>
                  </label>
                  <div className="owner-booking-fields">
                    <label>
                      Credit limit (MMK)
                      <input
                        type="number"
                        max={0}
                        min={-1000000}
                        step={1000}
                        value={fareForm.driverCreditFloorMmk}
                        onChange={e => setFareForm(f => ({ ...f, driverCreditFloorMmk: Math.min(0, Number(e.target.value) || 0) }))}
                      />
                      <span className="owner-booking-hint">
                        Commission (10%, min 200 Ks) is always charged. Drivers whose wallet falls below this stop receiving auto-offers until they top up.
                      </span>
                    </label>
                    <label className="owner-booking-span-2">
                      Top-up payment instructions (shown to drivers)
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={fareForm.walletPaymentInfo}
                        placeholder={'KBZPay: 09xxxxxxxxx (U Aung)\nWavePay: 09xxxxxxxxx'}
                        onChange={e => setFareForm(f => ({ ...f, walletPaymentInfo: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="owner-booking-fare-actions">
                    <button type="button" className="owner-primary-btn" onClick={handleSaveBookingFare}>
                      Save dispatch settings
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>Drivers</h1>
                <p className="owner-ops-subtitle">
                  {onlineDrivers} online · {availableDrivers} available · {busyDrivers} busy
                </p>
              </div>
              <button
                type="button"
                className="owner-primary-btn"
                onClick={() => {
                  setInviteForm(f => ({ ...f, role: 'driver' }));
                  setInviteError('');
                  setInviteSuccess('');
                  setShowInviteModal(true);
                }}
              >
                + Add driver
              </button>
            </div>

            <div className="owner-ops-search">
              <input
                type="search"
                placeholder="Search driver, phone, or plate…"
                value={driverSearch}
                onChange={e => setDriverSearch(e.target.value)}
              />
            </div>

            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-body">
                {driverCards.length === 0 ? (
                  <div className="owner-panel-empty">
                    No drivers yet.
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="owner-primary-btn" onClick={() => setShowInviteModal(true)}>
                        + Add driver
                      </button>
                    </div>
                  </div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Driver</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th className="num">Active</th>
                        <th className="num">Done</th>
                        <th className="num">Wallet</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverCards.map((m, i) => (
                        <tr key={m.id}>
                          <td>{i + 1}</td>
                          <td>
                            <span className="owner-table-title">{m.displayName}</span>
                            <span className="owner-table-sub">{m.user.phone}</span>
                          </td>
                          <td>
                            <span className="owner-table-title">{m.profile?.vehiclePlate || '—'}</span>
                            <span className="owner-table-sub">{m.profile?.vehicleModel || m.profile?.vehicleColor || 'No vehicle'}</span>
                          </td>
                          <td>
                            <span className={`owner-online-badge ${m.user.isOnline ? 'online' : 'offline'}`}>
                              {m.user.isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span className="owner-table-sub" style={{ marginTop: 4 }}>
                              {m.liveLoc?.status || 'No location'}
                            </span>
                          </td>
                          <td className="num">{m.activeTrips ?? 0}</td>
                          <td className="num">{m.completedTrips ?? 0}</td>
                          <td className="num owner-wallet-amount">{(m.wallet?.balanceMmk ?? 0).toLocaleString()}</td>
                          <td className="num">
                            <div className="owner-table-actions">
                              <button
                                type="button"
                                className="owner-primary-btn owner-ptt-btn"
                                disabled={driverPttBusy === m.userId}
                                onClick={() => handleDriverPTT(m.userId, m.displayName)}
                                title={`1:1 PTT with ${m.displayName}`}
                              >
                                <MicIcon size={14} />
                                {driverPttBusy === m.userId ? 'Opening…' : 'Talk 1:1'}
                              </button>
                              <button type="button" className="owner-secondary-btn" onClick={() => openDriverDetail(m.userId, m)}>
                                Manage
                              </button>
                              <button type="button" className="owner-secondary-btn" onClick={() => setActiveTab('map')}>
                                Map
                              </button>
                              <button type="button" className="owner-remove-btn" onClick={() => handleRemoveMember(m.userId, m.displayName)}>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>Channels</h1>
                <p className="owner-ops-subtitle">PTT radio channels · {channels.length} total</p>
              </div>
              <div className="owner-ops-actions">
                <button type="button" className="owner-secondary-btn" onClick={() => loadOrgChannels()}>Refresh</button>
                <button type="button" className="owner-primary-btn" onClick={openCreateChannel}>
                  + New channel
                </button>
              </div>
            </div>
            <div className="owner-ops-search">
              <input
                type="search"
                placeholder="Search channels…"
                value={channelSearch}
                onChange={e => setChannelSearch(e.target.value)}
              />
            </div>
            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-body">
                {filteredChannels.length === 0 ? (
                  <div className="owner-panel-empty">No channels yet. Create one for dispatch radio.</div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Channel</th>
                        <th>Members</th>
                        <th>Type</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChannels.map((ch, i) => {
                        const isDriverDM = !!ch.description?.startsWith('driver-ptt:');
                        return (
                          <tr key={ch.id}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{ch.name}</span>
                              <span className="owner-table-sub">
                                {isDriverDM ? '1:1 driver PTT' : (ch.description || 'No description')}
                              </span>
                            </td>
                            <td>{ch.memberCount ?? '—'}</td>
                            <td>{ch.isPrivate || isDriverDM ? 'Private' : 'Open'}</td>
                            <td className="num">
                              <div className="owner-table-actions">
                                <button type="button" className="owner-primary-btn" onClick={() => openChannelPTT(ch.id)}>
                                  Talk
                                </button>
                                <button
                                  type="button"
                                  className="owner-secondary-btn"
                                  onClick={() => {
                                    setPttChannelId(ch.id);
                                    setActiveTab('ptt');
                                  }}
                                >
                                  History
                                </button>
                                <button type="button" className="owner-secondary-btn" onClick={() => openManageChannel(ch.id)}>
                                  Members
                                </button>
                                <button type="button" className="owner-secondary-btn" onClick={() => openEditChannel(ch)}>
                                  Edit
                                </button>
                                <button type="button" className="owner-remove-btn" onClick={() => handleDeleteChannel(ch)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ptt' && (
          <div className="owner-tab-content owner-full">
            <div className="owner-page-head">
              <div>
                <h1>PTT History</h1>
                <p className="owner-ops-subtitle">Voice recordings by channel</p>
              </div>
              <div className="owner-ops-actions">
                <select
                  className="owner-select"
                  value={pttChannelId}
                  onChange={e => setPttChannelId(e.target.value)}
                >
                  <option value="">Select channel</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="owner-secondary-btn"
                  onClick={() => pttChannelId && loadPttHistory(pttChannelId)}
                >
                  Refresh
                </button>
                <button type="button" className="owner-primary-btn" onClick={() => navigate('/app')}>
                  Open PTT app
                </button>
              </div>
            </div>
            <div className="owner-panel owner-rides-panel">
              <div className="owner-panel-body">
                {!pttChannelId ? (
                  <div className="owner-panel-empty">Select a channel to view PTT history.</div>
                ) : pttBusy ? (
                  <div className="owner-panel-empty">{pttBusy}</div>
                ) : pttHistory.length === 0 ? (
                  <div className="owner-panel-empty">No recordings for this channel yet.</div>
                ) : (
                  <table className="owner-table owner-rides-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Speaker</th>
                        <th>Duration</th>
                        <th>Transcription</th>
                        <th>When</th>
                        <th className="num">Play</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pttHistory.map((r, i) => {
                        const name = `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim()
                          || r.user?.username
                          || 'Unknown';
                        const secs = Math.max(1, Math.round((r.durationMs || 0) / 1000));
                        return (
                          <tr key={r.id}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="owner-table-title">{name}</span>
                            </td>
                            <td>{secs}s</td>
                            <td>
                              <span className="owner-table-sub">
                                {r.transcriptionText
                                  || (r.transcriptionStatus === 'pending' ? 'Transcribing…' : '—')}
                              </span>
                            </td>
                            <td>
                              <span className="owner-table-sub">
                                {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                              </span>
                            </td>
                            <td className="num">
                              {r.fileUrl ? (
                                <audio controls preload="none" src={r.fileUrl} style={{ height: 32, maxWidth: 220 }} />
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="owner-tab-content owner-full owner-map-tab">
            <div className="owner-page-head">
              <div>
                <h1>Live Map</h1>
                <p className="owner-ops-subtitle">
                  Updates automatically every 15 seconds
                  {mapSyncedAt && ` · last update ${mapSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`}
                </p>
              </div>
              <div className="owner-ops-actions">
                <button type="button" className="owner-secondary-btn" onClick={() => void refreshMapLocations()} disabled={mapRefreshing}>
                  <RefreshCwIcon size={16} className={mapRefreshing ? 'owner-icon-spin' : ''} />
                  Refresh
                </button>
                <button type="button" className="owner-primary-btn" onClick={() => navigate('/dispatch')}>
                  Dispatch
                </button>
              </div>
            </div>

            <div className="owner-map-layout">
              <aside className="owner-map-sidebar">
                <div className="owner-map-sidebar-head">
                  <div className="owner-map-search-wrap">
                    <SearchIcon size={16} />
                    <input
                      type="search"
                      placeholder="Search driver or plate…"
                      value={mapSearch}
                      onChange={e => setMapSearch(e.target.value)}
                    />
                  </div>
                  <div className="owner-map-seg" role="tablist" aria-label="Driver status">
                    {([
                      { id: 'all' as const, label: 'All', count: driverCards.length || locations.length },
                      { id: 'available' as const, label: 'Available', count: availableDrivers },
                      { id: 'busy' as const, label: 'Busy', count: busyDrivers },
                      { id: 'offline' as const, label: 'Offline', count: offlineDriversForMap.length },
                    ]).map(f => (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={mapStatusFilter === f.id}
                        className={mapStatusFilter === f.id ? 'active' : ''}
                        onClick={() => setMapStatusFilter(f.id)}
                      >
                        <span className="owner-map-seg-count">{f.count}</span>
                        <span className="owner-map-seg-label">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="owner-map-driver-list">
                  {mapListDrivers.length === 0 ? (
                    <div className="owner-panel-empty">
                      <UsersIcon size={28} />
                      {driverCards.length === 0 && !mapSearch.trim() ? (
                        <>
                          <p>No drivers in this stand yet.</p>
                          <button type="button" className="owner-secondary-btn" onClick={() => setActiveTab('drivers')}>
                            Add drivers
                          </button>
                        </>
                      ) : (
                        <p>
                          {mapSearch.trim()
                            ? `No driver matches “${mapSearch.trim()}”.`
                            : mapStatusFilter === 'available' ? 'No driver is free right now.'
                            : mapStatusFilter === 'busy' ? 'No driver is on a ride right now.'
                            : 'Every driver is online.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    mapListDrivers.map((d, i) => (
                      <React.Fragment key={d.userId}>
                        {showOfflineRows && i === 0 && liveMapRows.length > 0 && (
                          <div className="owner-map-list-heading">On the map · {liveMapRows.length}</div>
                        )}
                        {showOfflineRows && i === firstOfflineIndex && (
                          <div className="owner-map-list-heading">Not sharing location · {offlineMapRows.length}</div>
                        )}
                        {d.online ? (
                          <button
                            type="button"
                            className={`owner-map-driver-row${mapFocusUserId === d.userId ? ' active' : ''}`}
                            onClick={() => focusDriverOnMap(d.userId, d.lat, d.lng)}
                            title="Show on map"
                          >
                            <span className={`owner-legend-dot ${d.status === 'busy' ? 'busy' : 'available'}`} />
                            <span className="owner-map-driver-meta">
                              <strong>{d.displayName}</strong>
                              <span>{[d.status === 'busy' ? 'On a ride' : 'Available', d.plate].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="owner-map-driver-speed">{Math.round(d.speed)} km/h</span>
                          </button>
                        ) : (
                          <div className="owner-map-driver-row offline">
                            <span className="owner-legend-dot offline" />
                            <span className="owner-map-driver-meta">
                              <strong>{d.displayName}</strong>
                              <span>{d.plate || d.phone || 'Not sharing location'}</span>
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </aside>

              <div className="owner-map-panel">
                <div className="owner-map-wrapper" ref={mapContainerRef} />
                <div className="owner-map-status">
                  {locations.length > 0 ? (
                    <><span className="owner-map-live-dot" /> {locations.length} driver{locations.length === 1 ? '' : 's'} live</>
                  ) : (
                    <>No driver is sharing location — they appear here when they go online in the driver app</>
                  )}
                </div>
                <div className="owner-map-controls">
                  <button type="button" title="Center on my location" aria-label="Center on my location" onClick={() => { void centerOnMe(); }}>
                    <LocateIcon size={18} />
                  </button>
                  <button
                    type="button"
                    title="Show all drivers"
                    aria-label="Show all drivers"
                    onClick={fitFleetOnMap}
                    disabled={filteredLocations.length === 0}
                  >
                    <MaximizeIcon size={18} />
                  </button>
                </div>
                <div className="owner-map-legend-float">
                  <span><span className="owner-legend-dot available" /> Available</span>
                  <span><span className="owner-legend-dot busy" /> On a ride</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="owner-tab-content">
            <div className="owner-page-head">
              <div>
                <h1>Profile & Settings</h1>
                <p className="owner-ops-subtitle">Company · fare · plan · usage</p>
              </div>
            </div>

            <div className="owner-settings-section">
              <h2>Company profile</h2>
              <div className="owner-company-edit">
                <label className="owner-settings-label">
                  Company name
                  <input value={companyNameDraft} onChange={e => setCompanyNameDraft(e.target.value)} />
                </label>
                <label className="owner-settings-label">
                  Subdomain
                  <input value={`${org.subdomain}.farepro.app`} disabled />
                </label>
                <button type="button" className="owner-primary-btn" onClick={handleSaveCompanyName}>Save company</button>
              </div>
              <div className="owner-company-list" style={{ marginTop: 16 }}>
                <div><strong>Signed in</strong><span>{user?.firstName || user?.username} · {orgRole}</span></div>
                <div><strong>Plan</strong><span className={`owner-plan-badge ${org.plan}`}>{org.plan}</span></div>
                <div><strong>PTT channels</strong><span>{org.channelCount}</span></div>
              </div>
            </div>

            <div className="owner-settings-section">
              <h2>Kilo Taxi Fare</h2>
              <p className="owner-settings-desc">
                Per-km pricing for passenger rides. Customers book at <code>/book/{org.subdomain}</code>.
              </p>
              <form className="owner-fare-form" onSubmit={handleSaveFareSettings}>
                <label className="owner-settings-label">
                  Rate per km (MMK)
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={fareForm.fareRatePerKm}
                    onChange={e => setFareForm(f => ({ ...f, fareRatePerKm: Number(e.target.value) }))}
                  />
                </label>
                <label className="owner-settings-label">
                  Minimum fare (MMK)
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={fareForm.fareMinimum}
                    onChange={e => setFareForm(f => ({ ...f, fareMinimum: Number(e.target.value) }))}
                  />
                </label>
                <label className="owner-settings-label">
                  Night multiplier (e.g. 1.2 = +20%)
                  <input
                    type="number"
                    min={1}
                    max={3}
                    step={0.1}
                    value={fareForm.fareNightMultiplier}
                    onChange={e => setFareForm(f => ({ ...f, fareNightMultiplier: Number(e.target.value) }))}
                  />
                </label>
                <div className="owner-fare-row">
                  <label className="owner-settings-label">
                    Night start (hour 0–23)
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={fareForm.fareNightStart}
                      onChange={e => setFareForm(f => ({ ...f, fareNightStart: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="owner-settings-label">
                    Night end (hour)
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={fareForm.fareNightEnd}
                      onChange={e => setFareForm(f => ({ ...f, fareNightEnd: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <label className="owner-settings-label">
                  Customer app title
                  <input
                    type="text"
                    value={fareForm.customerAppTitle}
                    onChange={e => setFareForm(f => ({ ...f, customerAppTitle: e.target.value }))}
                    placeholder={org.name}
                  />
                </label>
                <label className="owner-settings-toggle">
                  <input
                    type="checkbox"
                    checked={fareForm.bookingEnabled}
                    onChange={e => setFareForm(f => ({ ...f, bookingEnabled: e.target.checked }))}
                  />
                  <span>Enable online customer booking</span>
                </label>
                <div className="owner-booking-link">
                  <span>Customer booking link</span>
                  <code>{`${window.location.origin}/book/${org.subdomain}`}</code>
                  <button type="button" className="owner-link-btn" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${org.subdomain}`)}>Copy</button>
                </div>
                <button type="submit" className="owner-primary-btn">Save Fare Settings</button>
                {fareSaved && <span className="owner-save-ok">{fareSaved}</span>}
              </form>
            </div>

            <div className="owner-settings-section">
              <h2>Plan & Billing</h2>
              <div className="owner-usage-bar" style={{ marginBottom: 16 }}>
                <strong>Stand credit balance</strong>
                <span>{new Intl.NumberFormat('en-MM').format(org.billingBalanceMmk || 0)} Ks</span>
              </div>
              <p style={{ color: 'var(--tg-text-secondary)', fontSize: 13, marginBottom: 16 }}>
                Plan changes and topups are managed by FarePro Super Admin. Driver wallet topups stay in the Drivers tab.
              </p>
              <div className="owner-plans-grid">
                <div className={`owner-plan-card ${org.plan === 'free' ? 'current' : ''}`}>
                  <h3>Free</h3>
                  <span className="owner-plan-price">0 Ks/mo</span>
                  <ul>
                    <li>Up to 10 drivers</li>
                    <li>Up to 5 channels</li>
                    <li>Live map & PTT</li>
                    <li>Basic support</li>
                  </ul>
                  {org.plan === 'free' && <span className="owner-plan-current">Current Plan</span>}
                </div>
                <div className={`owner-plan-card ${org.plan === 'pro' ? 'current' : ''}`}>
                  <h3>Pro</h3>
                  <span className="owner-plan-price">Contact FarePro</span>
                  <ul>
                    <li>Up to 50 drivers</li>
                    <li>Up to 20 channels</li>
                    <li>Route trails & history</li>
                    <li>Priority support</li>
                  </ul>
                  {org.plan === 'pro' && <span className="owner-plan-current">Current Plan</span>}
                </div>
                <div className={`owner-plan-card ${org.plan === 'enterprise' ? 'current' : ''}`}>
                  <h3>Enterprise</h3>
                  <span className="owner-plan-price">Custom</span>
                  <ul>
                    <li>Up to 500 drivers</li>
                    <li>Up to 100 channels</li>
                    <li>Advanced analytics</li>
                    <li>24/7 dedicated support</li>
                    <li>Custom integrations</li>
                  </ul>
                  {org.plan === 'enterprise' && <span className="owner-plan-current">Current Plan</span>}
                </div>
              </div>
            </div>

            <div className="owner-settings-section">
              <h2>Usage</h2>
              <div className="owner-usage-bar">
                <label>Drivers: {org.driverCount} / {org.maxDrivers}</label>
                <div className="owner-progress">
                  <div className="owner-progress-fill" style={{ width: `${Math.min(100, (org.driverCount / org.maxDrivers) * 100)}%` }} />
                </div>
              </div>
              <div className="owner-usage-bar">
                <label>Channels: {org.channelCount} / {org.maxChannels}</label>
                <div className="owner-progress">
                  <div className="owner-progress-fill" style={{ width: `${Math.min(100, (org.channelCount / org.maxChannels) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showInviteModal && (
        <div className="owner-modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="owner-modal" onClick={e => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h2>{inviteForm.role === 'driver' ? 'Add driver' : 'Add staff'}</h2>
              <button type="button" className="owner-modal-close" onClick={() => setShowInviteModal(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="owner-modal-body">
                {inviteError && <div className="owner-alert error">{inviteError}</div>}
                {inviteSuccess && <div className="owner-alert success">{inviteSuccess}</div>}
                <label className="owner-settings-label">
                  Phone
                  <input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    required
                    placeholder="09xxxxxxxxx"
                  />
                </label>
                <label className="owner-settings-label">
                  First name
                  <input
                    type="text"
                    value={inviteForm.firstName}
                    onChange={e => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </label>
                <label className="owner-settings-label">
                  Last name
                  <input
                    type="text"
                    value={inviteForm.lastName}
                    onChange={e => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </label>
                <label className="owner-settings-label">
                  Role
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  >
                    {inviteForm.role === 'driver' ? (
                      <>
                        <option value="driver">Driver</option>
                        <option value="dispatcher">Dispatcher</option>
                        <option value="admin">Admin</option>
                      </>
                    ) : (
                      <>
                        <option value="dispatcher">Dispatcher — assign rides</option>
                        <option value="admin">Admin — portal access</option>
                      </>
                    )}
                  </select>
                </label>
                {inviteForm.role !== 'driver' && (
                  <p className="owner-settings-desc">
                    Dispatchers use `/dispatch`. Admins can open Owner Portal. Drivers belong on the Drivers page.
                  </p>
                )}
              </div>
              <div className="owner-modal-foot">
                <button type="button" className="owner-secondary-btn" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="owner-primary-btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="owner-modal-backdrop" onClick={() => setShowCustomerModal(false)}>
          <div className="owner-modal" onClick={e => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h2>{editingCustomerId ? 'Edit customer' : 'Add customer'}</h2>
              <button type="button" className="owner-modal-close" onClick={() => setShowCustomerModal(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSaveCustomer}>
              <div className="owner-modal-body">
                {customerBusy && customerBusy !== 'Loading rides…' && customerBusy !== 'Saving…' && (
                  <div className="owner-alert error">{customerBusy}</div>
                )}
                <label className="owner-settings-label">
                  Name
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Customer name"
                  />
                </label>
                <label className="owner-settings-label">
                  Phone
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                    required
                    placeholder="09xxxxxxxxx"
                  />
                </label>
                <label className="owner-settings-label">
                  Notes
                  <input
                    type="text"
                    value={customerForm.notes}
                    onChange={e => setCustomerForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="VIP, preferred vehicle, landmark…"
                  />
                </label>
              </div>
              <div className="owner-modal-foot">
                <button type="button" className="owner-secondary-btn" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className="owner-primary-btn" disabled={customerBusy === 'Saving…'}>
                  {customerBusy === 'Saving…' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChannelModal && (
        <div className="owner-modal-backdrop" onClick={() => setShowChannelModal(false)}>
          <div className="owner-modal" onClick={e => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h2>{editingChannelId ? 'Edit channel' : 'New channel'}</h2>
              <button type="button" className="owner-modal-close" onClick={() => setShowChannelModal(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSaveChannel}>
              <div className="owner-modal-body">
                {channelBusy && <p className="owner-ops-subtitle">{channelBusy}</p>}
                <label className="owner-settings-label">
                  Channel name
                  <input
                    value={channelForm.name}
                    onChange={e => setChannelForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Dispatch / Downtown / Night shift"
                  />
                </label>
                <label className="owner-settings-label">
                  Description
                  <input
                    value={channelForm.description}
                    onChange={e => setChannelForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label className="owner-settings-toggle">
                  <input
                    type="checkbox"
                    checked={channelForm.isPrivate}
                    onChange={e => setChannelForm(f => ({ ...f, isPrivate: e.target.checked }))}
                  />
                  <span>Private channel</span>
                </label>
              </div>
              <div className="owner-modal-foot">
                <button type="button" className="owner-secondary-btn" onClick={() => setShowChannelModal(false)}>Cancel</button>
                <button type="submit" className="owner-primary-btn" disabled={!!channelBusy}>
                  {editingChannelId ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageChannelId && (
        <div className="owner-modal-backdrop" onClick={() => setManageChannelId(null)}>
          <div className="owner-modal owner-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h2>Channel members</h2>
              <button type="button" className="owner-modal-close" onClick={() => setManageChannelId(null)} aria-label="Close">×</button>
            </div>
            <div className="owner-modal-body">
              {channelBusy && <p className="owner-ops-subtitle">{channelBusy}</p>}
              <div className="owner-toolbar" style={{ marginBottom: 16 }}>
                <select
                  className="owner-select"
                  value={addMemberId}
                  onChange={e => setAddMemberId(e.target.value)}
                >
                  <option value="">Add org member…</option>
                  {members
                    .filter(m => !channelMembers.some(cm => cm.userId === m.userId))
                    .map(m => {
                      const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username;
                      return (
                        <option key={m.userId} value={m.userId}>
                          {name} ({m.role})
                        </option>
                      );
                    })}
                </select>
                <button type="button" className="owner-primary-btn" onClick={handleAddChannelMember} disabled={!addMemberId}>
                  Add
                </button>
              </div>
              <table className="owner-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Member</th>
                    <th>Role</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channelMembers.map((m, i) => {
                    const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() || m.user?.username || m.userId;
                    return (
                      <tr key={m.userId}>
                        <td>{i + 1}</td>
                        <td>
                          <span className="owner-table-title">{name}</span>
                          <span className="owner-table-sub">{m.user?.phone || ''}</span>
                        </td>
                        <td>{m.role}</td>
                        <td className="num">
                          <button type="button" className="owner-remove-btn" onClick={() => handleRemoveChannelMember(m.userId)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {channelMembers.length === 0 && (
                    <tr>
                      <td colSpan={4}><div className="owner-panel-empty">No members yet.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="owner-modal-foot">
              <button type="button" className="owner-secondary-btn" onClick={() => setManageChannelId(null)}>Close</button>
              <button type="button" className="owner-primary-btn" onClick={() => openChannelPTT(manageChannelId)}>Talk now</button>
            </div>
          </div>
        </div>
      )}

      {selectedDriver && (
        <div className="owner-modal-backdrop" onClick={() => setSelectedDriverId(null)}>
          <div className="owner-modal owner-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h2>{selectedDriver.displayName}</h2>
              <button type="button" className="owner-modal-close" onClick={() => setSelectedDriverId(null)} aria-label="Close">×</button>
            </div>
            <div className="owner-modal-body">
              {driverBusy && <p className="owner-ops-subtitle">{driverBusy}</p>}
              <div className="owner-driver-detail-grid">
                <section className="owner-settings-section">
                  <h3>Vehicle & profile</h3>
                  <label className="owner-settings-label">Plate<input value={profileForm.vehiclePlate} onChange={e => setProfileForm(f => ({ ...f, vehiclePlate: e.target.value }))} /></label>
                  <label className="owner-settings-label">Model<input value={profileForm.vehicleModel} onChange={e => setProfileForm(f => ({ ...f, vehicleModel: e.target.value }))} /></label>
                  <label className="owner-settings-label">Color<input value={profileForm.vehicleColor} onChange={e => setProfileForm(f => ({ ...f, vehicleColor: e.target.value }))} /></label>
                  <label className="owner-settings-label">License<input value={profileForm.licenseNo} onChange={e => setProfileForm(f => ({ ...f, licenseNo: e.target.value }))} /></label>
                  <label className="owner-settings-label">NRC<input value={profileForm.nrc} onChange={e => setProfileForm(f => ({ ...f, nrc: e.target.value }))} /></label>
                  <label className="owner-settings-label">Notes<input value={profileForm.notes} onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))} /></label>
                  <button type="button" className="owner-primary-btn" onClick={handleSaveProfile}>Save profile</button>
                </section>
                <section className="owner-settings-section">
                  <h3>Wallet</h3>
                  <p className="owner-settings-desc">
                    Balance: <strong>{(selectedDriver.wallet?.balanceMmk ?? 0).toLocaleString()} MMK</strong>
                  </p>
                  <label className="owner-settings-label">
                    Type
                    <select value={walletForm.entryType} onChange={e => setWalletForm(f => ({ ...f, entryType: e.target.value as 'credit' | 'debit' | 'adjust' }))}>
                      <option value="credit">Credit (+)</option>
                      <option value="debit">Debit (−)</option>
                      <option value="adjust">Adjust (±)</option>
                    </select>
                  </label>
                  <label className="owner-settings-label">
                    Amount (MMK)
                    <input type="number" value={walletForm.amountMmk || ''} onChange={e => setWalletForm(f => ({ ...f, amountMmk: Number(e.target.value) }))} />
                  </label>
                  <label className="owner-settings-label">
                    Reason
                    <input value={walletForm.reason} onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))} />
                  </label>
                  <button type="button" className="owner-primary-btn" onClick={handleAdjustWallet}>Update wallet</button>
                  <button
                    type="button"
                    className="owner-secondary-btn"
                    style={{ marginTop: 12 }}
                    disabled={driverPttBusy === selectedDriver.userId}
                    onClick={() => handleDriverPTT(selectedDriver.userId, selectedDriver.displayName)}
                  >
                    {driverPttBusy === selectedDriver.userId ? 'Opening PTT…' : 'Talk PTT with driver'}
                  </button>
                </section>
              </div>
            </div>
            <div className="owner-modal-foot">
              <button type="button" className="owner-secondary-btn" onClick={() => setSelectedDriverId(null)}>Close</button>
              <button
                type="button"
                className="owner-primary-btn owner-ptt-btn"
                disabled={driverPttBusy === selectedDriver.userId}
                onClick={() => handleDriverPTT(selectedDriver.userId, selectedDriver.displayName)}
              >
                <MicIcon size={14} />
                {driverPttBusy === selectedDriver.userId ? 'Opening…' : 'Talk 1:1 PTT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
