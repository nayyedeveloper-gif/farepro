import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useSound } from '../../contexts/SoundContext';
import { BrandMark } from '../brand/BrandMark';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clearOrgContext, syncOrgContext } from '../../utils/orgStorage';
import { formatMMK } from '../../services/bookingApi';
import {
  getMapCenter,
  addTileLayer,
  setupMapResizeObserver,
  updateMyLocationMarker,
  fitToLatLngs,
  getCurrentPosition,
} from '../../utils/leafletMap';
import { LocateIcon, MaximizeIcon, SearchIcon, PlusIcon, XIcon, MicIcon, RefreshCwIcon } from '../icons/Icons';

interface OrgInfo {
  id: string;
  name: string;
  subdomain: string;
}

interface FleetMember {
  userId: string;
  role: string;
  user: {
    id: string;
    username: string;
    phone: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
    isOnline: boolean;
  };
  location?: {
    channelId: string;
    userId: string;
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    status: string;
    updatedAt: string;
  };
}

interface FleetChannel {
  id: string;
  name: string;
  memberCount: number;
}

interface GeofenceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  alertOn: 'enter' | 'exit' | 'both';
  color: string;
  isActive: boolean;
  channelId?: string;
}

interface GeofenceAlert {
  id: string;
  zoneId: string;
  userId: string;
  eventType: 'enter' | 'exit';
  createdAt: string;
  zone?: { id: string; name: string; color: string };
  user?: { firstName: string; lastName: string; username: string };
}

interface TripJob {
  id: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  driverId?: string;
  notes?: string;
  createdAt: string;
  customerPhone?: string;
  distanceKm?: number;
  estimatedFare?: number;
  bookingSource?: string;
  serviceType?: string;
  vehicleType?: string;
  parcelNotes?: string;
  driver?: { firstName: string; lastName: string; username: string };
}

interface OrgCustomer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  tripCount: number;
  lastTripAt?: string;
}

const TRIP_STATUS_LABEL: Record<string, string> = {
  requested: 'New request',
  pending: 'Pending',
  assigned: 'Awaiting driver',
  en_route: 'En route',
  arrived: 'Arrived',
  completed: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#2d9c78',
  busy: '#f39c12',
  off: '#888',
};

function tripFingerprint(t: TripJob): string {
  return [
    (t.customerPhone || '').replace(/\D/g, ''),
    (t.pickupAddress || '').trim().toLowerCase(),
    (t.dropoffAddress || '').trim().toLowerCase(),
    t.status,
    String(t.estimatedFare ?? ''),
    String(t.distanceKm ?? ''),
  ].join('|');
}

/** Keep unique trip ids, then drop near-identical active duplicates (same route/phone/fare). */
function dedupeTrips(list: TripJob[]): TripJob[] {
  const byId = new Map<string, TripJob>();
  for (const t of list) {
    if (!t?.id) continue;
    byId.set(t.id, t);
  }
  const unique = Array.from(byId.values())
    .filter(t => t.serviceType !== 'delivery')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const seenFp = new Set<string>();
  const out: TripJob[] = [];
  for (const t of unique) {
    const fp = tripFingerprint(t);
    if (seenFp.has(fp)) continue;
    seenFp.add(fp);
    out.push(t);
  }
  return out;
}

function createDriverIcon(status: string, label: string, heading: number): L.DivIcon {
  const color = STATUS_COLORS[status] || '#888';
  const rotation = heading ? `transform: rotate(${heading}deg);` : '';
  return L.divIcon({
    className: 'ptt-driver-marker',
    html: `
      <div class="ptt-driver-pin" style="--pin-color: ${color};">
        <div class="ptt-driver-rotate" style="${rotation}">
          <svg class="ptt-driver-arrow-svg" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
            <path d="M7 0L13.062 9.75H0.938L7 0Z" fill="var(--pin-color, #F26522)"/>
          </svg>
          <div class="ptt-driver-label"><span class="ptt-driver-initial">${label}</span></div>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

export default function DispatchConsole() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { subscribe } = useSocket();
  const { playNotification } = useSound();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<FleetMember[]>([]);
  const [channels, setChannels] = useState<FleetChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannelId, setBroadcastChannelId] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');
  const [orgRole, setOrgRole] = useState('');
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radiusMeters: '500',
    alertOn: 'both' as 'enter' | 'exit' | 'both',
    channelId: '',
  });
  const [placingZone, setPlacingZone] = useState(false);
  const [zoneStatus, setZoneStatus] = useState('');
  const [trips, setTrips] = useState<TripJob[]>([]);
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripForm, setTripForm] = useState({
    customerName: '',
    customerPhone: '',
    pickupAddress: '',
    dropoffAddress: '',
    driverId: '',
    notes: '',
  });
  const [customerHits, setCustomerHits] = useState<OrgCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<TripJob[]>([]);
  const [customerLookupBusy, setCustomerLookupBusy] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tripStatus, setTripStatus] = useState('');
  const [rightTab, setRightTab] = useState<'jobs' | 'radio' | 'zones' | 'alerts'>('jobs');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverPttBusy, setDriverPttBusy] = useState('');
  const [mapBannerDismissed, setMapBannerDismissed] = useState(false);
  const [fleetRefreshing, setFleetRefreshing] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const zoneLayersRef = useRef<Record<string, L.Circle>>({});
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const myLocationCoordsRef = useRef<[number, number] | null>(null);
  const hasFittedFleetRef = useRef(false);

  const loadGeofence = useCallback(async () => {
    try {
      const [zonesRes, alertsRes] = await Promise.all([
        orgAPI.getGeofenceZones(),
        orgAPI.getGeofenceAlerts(30),
      ]);
      setZones(zonesRes.data || []);
      setAlerts(alertsRes.data || []);
    } catch (err) {
      console.error('[DispatchConsole] Failed to load geofence data:', err);
    }
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      const res = await orgAPI.getTrips({ serviceType: 'taxi' });
      setTrips(dedupeTrips(res.data || []));
    } catch (err) {
      console.error('[DispatchConsole] Failed to load trips:', err);
    }
  }, []);

  const loadFleet = useCallback(async () => {
    try {
      const [orgRes, fleetRes] = await Promise.all([orgAPI.getOrg(), orgAPI.getFleet()]);
      setOrg(orgRes.data);
      setMembers(fleetRes.data.members || []);
      setChannels(fleetRes.data.channels || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        clearOrgContext();
        navigate('/org/signin');
      }
    }
  }, [navigate]);

  const refreshFleet = useCallback(async () => {
    setFleetRefreshing(true);
    try {
      await Promise.all([loadFleet(), loadTrips(), loadGeofence()]);
    } finally {
      setFleetRefreshing(false);
    }
  }, [loadFleet, loadTrips, loadGeofence]);

  const handleDriverPTT = useCallback(async (userId: string, displayName: string) => {
    setDriverPttBusy(userId);
    try {
      const res = await orgAPI.ensureDriverPttChannel(userId);
      const channelId = res.data?.id;
      if (!channelId) throw new Error('No channel');
      navigate(`/app?channel=${encodeURIComponent(channelId)}`);
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to open PTT with ${displayName}`);
    } finally {
      setDriverPttBusy('');
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ctx = await syncOrgContext();
      if (cancelled) return;

      if (!ctx.hasOrg || !ctx.role) {
        navigate('/org/signin');
        return;
      }

      if (ctx.role !== 'dispatcher' && ctx.role !== 'admin' && ctx.role !== 'owner') {
        navigate('/app');
        return;
      }

      setOrgRole(ctx.role);
      await Promise.all([loadFleet(), loadGeofence(), loadTrips()]);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [navigate, loadFleet, loadGeofence, loadTrips]);

  useEffect(() => {
    const unsub = subscribe('channel.location', (data: unknown) => {
      const loc = data as FleetMember['location'] & { user?: FleetMember['user'] };
      if (!loc?.userId) return;
      setMembers(prev => prev.map(m => {
        if (m.userId !== loc.userId) return m;
        return { ...m, location: { ...loc, channelId: loc.channelId } };
      }));
    });
    const unsub2 = subscribe('channel.location_cleared', (data: unknown) => {
      const payload = data as { userId: string };
      setMembers(prev => prev.map(m =>
        m.userId === payload.userId ? { ...m, location: undefined } : m
      ));
    });
    const unsub3 = subscribe('ptt.status', (data: unknown) => {
      const payload = data as { userId: string; status: string };
      setMembers(prev => prev.map(m => {
        if (m.userId !== payload.userId || !m.location) return m;
        return { ...m, location: { ...m.location, status: payload.status } };
      }));
    });
    const unsub4 = subscribe('geofence.alert', (data: unknown) => {
      const alert = data as GeofenceAlert;
      if (!alert?.id) return;
      setAlerts(prev => [alert, ...prev].slice(0, 30));
    });
    const unsub5 = subscribe('trip.updated', (data: unknown) => {
      const trip = data as TripJob;
      if (!trip?.id || trip.serviceType === 'delivery') return;
      setTrips(prev => {
        const without = prev.filter(t => t.id !== trip.id);
        if (trip.status === 'completed' || trip.status === 'cancelled') {
          return dedupeTrips(without);
        }
        const wasNew = !prev.some(t => t.id === trip.id);
        if (wasNew && trip.status === 'requested') {
          playNotification();
          setTripStatus('New customer request — assign a driver');
          setTimeout(() => setTripStatus(''), 5000);
        } else if (!wasNew) {
          const prevTrip = prev.find(t => t.id === trip.id);
          if (trip.status === 'requested' && prevTrip && prevTrip.status !== 'requested') {
            playNotification();
            setTripStatus('Job returned — reassign driver');
            setTimeout(() => setTripStatus(''), 5000);
          }
        }
        return dedupeTrips([trip, ...without]);
      });
    });
    return () => { unsub(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [subscribe, playNotification]);

  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;

    let disposed = false;
    let cleanupResize: (() => void) | undefined;
    const container = mapContainerRef.current;

    // Sync init so tiles paint immediately (Yangon fallback), then refine with GPS.
    const map = L.map(container, {
      center: [16.8661, 96.1951],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    addTileLayer(map);
    mapRef.current = map;
    cleanupResize = setupMapResizeObserver(map, container);
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);

    (async () => {
      try {
        const center = await getMapCenter();
        if (disposed || !mapRef.current) return;
        myLocationCoordsRef.current = center;
        updateMyLocationMarker(mapRef.current, myLocationMarkerRef, center[0], center[1]);
        if (!hasFittedFleetRef.current) {
          mapRef.current.setView(center, 14);
        }
      } catch {
        // keep fallback center
      }
    })();

    return () => {
      disposed = true;
      cleanupResize?.();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = {};
      zoneLayersRef.current = {};
      myLocationMarkerRef.current = null;
      hasFittedFleetRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map boots once after loading; fleet fit handled separately
  }, [loading]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const activeZones = zones.filter(z => z.isActive);
    const currentIds = new Set(activeZones.map(z => z.id));

    for (const zone of activeZones) {
      if (zoneLayersRef.current[zone.id]) {
        zoneLayersRef.current[zone.id].setLatLng([zone.latitude, zone.longitude]);
        zoneLayersRef.current[zone.id].setRadius(zone.radiusMeters);
        zoneLayersRef.current[zone.id].setStyle({ color: zone.color, fillColor: zone.color });
      } else {
        const circle = L.circle([zone.latitude, zone.longitude], {
          radius: zone.radiusMeters,
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);
        circle.bindPopup(`<b>${zone.name}</b><br>${zone.radiusMeters}m · ${zone.alertOn}`);
        zoneLayersRef.current[zone.id] = circle;
      }
    }

    for (const zoneId of Object.keys(zoneLayersRef.current)) {
      if (!currentIds.has(zoneId)) {
        map.removeLayer(zoneLayersRef.current[zoneId]);
        delete zoneLayersRef.current[zoneId];
      }
    }
  }, [zones]);

  useEffect(() => {
    if (!mapRef.current || !placingZone) return;
    const map = mapRef.current;
    const onClick = (e: L.LeafletMouseEvent) => {
      setZoneForm(prev => ({
        ...prev,
        latitude: e.latlng.lat.toFixed(6),
        longitude: e.latlng.lng.toFixed(6),
      }));
      setPlacingZone(false);
      setShowZoneForm(true);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [placingZone]);

  const locatedMembers = members.filter(m => m.location);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentIds = new Set<string>();

    for (const m of locatedMembers) {
      const loc = m.location!;
      currentIds.add(m.userId);
      const name = m.user.firstName || m.user.username || '?';
      const label = name.charAt(0).toUpperCase();
      const icon = createDriverIcon(loc.status, label, loc.heading);

      if (markersRef.current[m.userId]) {
        markersRef.current[m.userId].setLatLng([loc.latitude, loc.longitude]);
        markersRef.current[m.userId].setIcon(icon);
        markersRef.current[m.userId].setPopupContent(
          `<b>${name}</b><br>Status: ${loc.status}<br>Speed: ${(loc.speed || 0).toFixed(0)} km/h`
        );
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindPopup(`<b>${name}</b><br>Status: ${loc.status}`);
        marker.on('click', () => setSelectedDriverId(m.userId));
        markersRef.current[m.userId] = marker;
      }
    }

    for (const userId of Object.keys(markersRef.current)) {
      if (!currentIds.has(userId)) {
        map.removeLayer(markersRef.current[userId]);
        delete markersRef.current[userId];
      }
    }

    if (selectedDriverId && markersRef.current[selectedDriverId]) {
      const loc = locatedMembers.find(m => m.userId === selectedDriverId)?.location;
      if (loc) map.setView([loc.latitude, loc.longitude], 16);
    } else if (locatedMembers.length > 0 && !hasFittedFleetRef.current) {
      const points: [number, number][] = locatedMembers.map(
        m => [m.location!.latitude, m.location!.longitude] as [number, number]
      );
      if (myLocationCoordsRef.current) points.push(myLocationCoordsRef.current);
      fitToLatLngs(map, points, 14);
      hasFittedFleetRef.current = true;
    }
  }, [locatedMembers, selectedDriverId]);

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
    const points: [number, number][] = locatedMembers.map(
      m => [m.location!.latitude, m.location!.longitude] as [number, number]
    );
    if (myLocationCoordsRef.current) points.push(myLocationCoordsRef.current);
    zones.filter(z => z.isActive).forEach(z => points.push([z.latitude, z.longitude]));
    if (points.length === 0) {
      centerOnMe();
      return;
    }
    fitToLatLngs(mapRef.current, points, 14);
  }, [locatedMembers, zones, centerOnMe]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setBroadcastStatus('');
    try {
      await orgAPI.broadcast({
        message: broadcastMsg.trim(),
        channelId: broadcastChannelId || undefined,
      });
      setBroadcastMsg('');
      setBroadcastStatus('Sent to team');
      setTimeout(() => setBroadcastStatus(''), 3000);
    } catch (err: any) {
      setBroadcastStatus(err.response?.data?.error || 'Failed to send');
    }
  };

  const handleLogout = () => {
    logout();
    clearOrgContext();
    navigate('/org/signin');
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setZoneStatus('');
    const lat = parseFloat(zoneForm.latitude);
    const lng = parseFloat(zoneForm.longitude);
    const radius = parseFloat(zoneForm.radiusMeters);
    if (!zoneForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      setZoneStatus('Fill all fields');
      return;
    }
    try {
      const res = await orgAPI.createGeofenceZone({
        name: zoneForm.name.trim(),
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        alertOn: zoneForm.alertOn,
        channelId: zoneForm.channelId || undefined,
      });
      setZones(prev => [res.data, ...prev]);
      setZoneForm({ name: '', latitude: '', longitude: '', radiusMeters: '500', alertOn: 'both', channelId: '' });
      setShowZoneForm(false);
      setZoneStatus('Zone created');
      setTimeout(() => setZoneStatus(''), 3000);
    } catch (err: any) {
      setZoneStatus(err.response?.data?.error || 'Failed to create zone');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await orgAPI.deleteGeofenceZone(zoneId);
      setZones(prev => prev.filter(z => z.id !== zoneId));
    } catch (err) {
      console.error('[DispatchConsole] Failed to delete zone:', err);
    }
  };

  const formatAlertTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getDriverName = (alert: GeofenceAlert) => {
    const u = alert.user;
    if (!u) return 'Driver';
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return name || u.username || 'Driver';
  };

  const driverMembers = members.filter(m => m.role === 'driver');

  const getTripDriverName = (trip: TripJob) => {
    if (trip.driver) {
      const name = `${trip.driver.firstName || ''} ${trip.driver.lastName || ''}`.trim();
      return name || trip.driver.username || 'Driver';
    }
    const m = driverMembers.find(d => d.userId === trip.driverId);
    if (!m) return 'Unassigned';
    return `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username;
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripStatus('');
    try {
      const res = await orgAPI.createTrip({
        customerName: tripForm.customerName.trim(),
        customerPhone: tripForm.customerPhone.trim() || undefined,
        pickupAddress: tripForm.pickupAddress.trim(),
        dropoffAddress: tripForm.dropoffAddress.trim(),
        driverId: tripForm.driverId || undefined,
        notes: tripForm.notes.trim() || undefined,
        serviceType: 'taxi',
        vehicleType: 'car',
      });
      setTrips(prev => dedupeTrips([res.data, ...prev]));
      setTripForm({
        customerName: '',
        customerPhone: '',
        pickupAddress: '',
        dropoffAddress: '',
        driverId: '',
        notes: '',
      });
      setCustomerHits([]);
      setSelectedCustomerId(null);
      setCustomerHistory([]);
      setShowTripForm(false);
      setTripStatus('Ride created');
      setTimeout(() => setTripStatus(''), 3000);
    } catch (err: any) {
      setTripStatus(err.response?.data?.error || 'Failed to create job');
    }
  };

  const searchCustomers = (q: string) => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    const query = q.trim();
    if (query.length < 2) {
      setCustomerHits([]);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      setCustomerLookupBusy(true);
      try {
        const res = await orgAPI.getCustomers(query);
        setCustomerHits((res.data || []).slice(0, 6));
      } catch {
        setCustomerHits([]);
      } finally {
        setCustomerLookupBusy(false);
      }
    }, 280);
  };

  const pickCustomer = async (c: OrgCustomer) => {
    setSelectedCustomerId(c.id);
    setTripForm(p => ({
      ...p,
      customerName: c.name,
      customerPhone: c.phone,
      notes: c.notes ? c.notes : p.notes,
    }));
    setCustomerHits([]);
    setCustomerLookupBusy(true);
    try {
      const res = await orgAPI.getCustomerTrips(c.id);
      setCustomerHistory((res.data || []).slice(0, 5));
    } catch {
      setCustomerHistory([]);
    } finally {
      setCustomerLookupBusy(false);
    }
  };

  const reusePastRide = (t: TripJob) => {
    setTripForm(p => ({
      ...p,
      pickupAddress: t.pickupAddress || p.pickupAddress,
      dropoffAddress: t.dropoffAddress || p.dropoffAddress,
    }));
  };

  const handleAutoAssignTrip = async (tripId: string) => {
    try {
      const res = await orgAPI.autoAssignTrip(tripId);
      const payload = res.data as { trip?: TripJob; distanceKm?: number; offerSeconds?: number } & TripJob;
      const trip = payload.trip || payload;
      if (trip?.id) {
        setTrips(prev => dedupeTrips(prev.map(t => (t.id === trip.id ? { ...t, ...trip } : t))));
        const name = trip.driver ? [trip.driver.firstName, trip.driver.lastName].filter(Boolean).join(' ') : 'nearest driver';
        const km = typeof payload.distanceKm === 'number' ? ` (${payload.distanceKm.toFixed(1)} km away)` : '';
        setTripStatus(`Offered to ${name}${km} · ${payload.offerSeconds ?? 30}s to accept, then the next nearest driver`);
        window.setTimeout(() => setTripStatus(''), 6000);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      window.alert(msg || 'Auto-offer failed — need live driver GPS');
    }
  };

  const handleAssignTrip = async (tripId: string, driverId: string) => {
    if (!driverId) return;
    try {
      const res = await orgAPI.assignTrip(tripId, driverId);
      setTrips(prev => dedupeTrips(prev.map(t => t.id === tripId ? res.data : t)));
    } catch (err) {
      console.error('[DispatchConsole] Failed to assign trip:', err);
    }
  };

  const handleTripStatus = async (tripId: string, status: string) => {
    try {
      const res = await orgAPI.updateTrip(tripId, { status });
      setTrips(prev => dedupeTrips(prev.map(t => t.id === tripId ? res.data : t)));
    } catch (err) {
      console.error('[DispatchConsole] Failed to update trip:', err);
    }
  };

  const getDriverStatus = (m: FleetMember) => {
    if (!m.user.isOnline) return 'offline';
    return m.location?.status || 'offline';
  };

  const filteredMembers = members.filter(m => {
    if (m.role !== 'driver') return false;
    if (driverSearch.trim()) {
      const q = driverSearch.toLowerCase();
      const name = `${m.user.firstName || ''} ${m.user.lastName || ''} ${m.user.username} ${m.user.phone}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (filter === 'all') return true;
    return getDriverStatus(m) === filter;
  });

  const activeTrips = dedupeTrips(
    trips.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.serviceType !== 'delivery')
  );
  const requestedCount = activeTrips.filter(t => t.status === 'requested').length;

  const stats = {
    available: members.filter(m => m.role === 'driver' && getDriverStatus(m) === 'available').length,
    busy: members.filter(m => m.role === 'driver' && getDriverStatus(m) === 'busy').length,
    offline: members.filter(m => m.role === 'driver' && getDriverStatus(m) === 'offline').length,
  };

  if (loading) {
    return (
      <div className="dispatch-loading">
        <BrandMark size={56} />
        <p>Loading dispatch console...</p>
      </div>
    );
  }

  return (
    <div className="dispatch-console">
      <header className="dispatch-header">
        <div className="dispatch-header-left">
          <BrandMark size={36} />
          <div>
            <h1>Dispatch</h1>
            <span>{org?.name}</span>
          </div>
        </div>
        <div className="dispatch-header-stats">
          <span className="dispatch-stat available">{stats.available} Available</span>
          <span className="dispatch-stat busy">{stats.busy} Busy</span>
          <span className="dispatch-stat offline">{stats.offline} Offline</span>
          <span className="dispatch-stat live">{locatedMembers.length} Live GPS</span>
        </div>
        <div className="dispatch-header-actions">
          <button type="button" className="dispatch-icon-btn" onClick={refreshFleet} title="Refresh" disabled={fleetRefreshing}>
            <RefreshCwIcon size={15} />
          </button>
          {(orgRole === 'owner' || orgRole === 'admin') && (
            <button type="button" onClick={() => navigate('/portal')}>Portal</button>
          )}
          <button type="button" onClick={() => navigate('/app')}>PTT</button>
          <button type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="dispatch-body">
        <aside className="dispatch-drivers">
          <div className="dispatch-drivers-search">
            <SearchIcon size={16} />
            <input
              type="search"
              placeholder="Search drivers..."
              value={driverSearch}
              onChange={e => setDriverSearch(e.target.value)}
            />
          </div>
          <div className="dispatch-filters">
            {(['all', 'available', 'busy', 'offline'] as const).map(f => (
              <button
                key={f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="dispatch-driver-list">
            {filteredMembers.map(m => {
              const status = getDriverStatus(m);
              const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username;
              const hasGps = !!m.location;
              return (
                <div
                  key={m.userId}
                  className={`dispatch-driver-row ${selectedDriverId === m.userId ? 'selected' : ''}`}
                >
                  <button
                    type="button"
                    className="dispatch-driver-main"
                    onClick={() => {
                      setSelectedDriverId(m.userId);
                      if (m.location && mapRef.current) {
                        mapRef.current.setView([m.location.latitude, m.location.longitude], 16);
                      }
                    }}
                  >
                    <span className={`dispatch-status-dot ${status}`} />
                    <div className="dispatch-driver-info">
                      <span className="dispatch-driver-name">{name}</span>
                      <span className="dispatch-driver-meta">
                        {status}
                        {hasGps ? ` · ${(m.location!.speed || 0).toFixed(0)} km/h` : ' · no GPS'}
                        {m.user.phone ? ` · ${m.user.phone}` : ''}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="dispatch-driver-ptt"
                    title={`Talk 1:1 with ${name}`}
                    disabled={driverPttBusy === m.userId}
                    onClick={() => handleDriverPTT(m.userId, name)}
                  >
                    <MicIcon size={14} />
                  </button>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <p className="dispatch-empty">No drivers match this filter</p>
            )}
          </div>
        </aside>

        <main className="dispatch-map-panel">
          <div className="dispatch-map" ref={mapContainerRef} />
          {placingZone && (
            <div className="dispatch-map-hint">Tap the map to place your geofence center</div>
          )}
          {locatedMembers.length === 0 && !placingZone && !mapBannerDismissed && (
            <div className="dispatch-map-banner">
              <div>
                <strong>Waiting for driver GPS</strong>
                <span>Drivers share location from the app when online. Map stays usable meanwhile.</span>
              </div>
              <div className="dispatch-map-banner-actions">
                <button type="button" className="dispatch-primary-btn" onClick={centerOnMe}>
                  <LocateIcon size={14} />
                  My location
                </button>
                <button type="button" className="dispatch-ghost-btn" onClick={() => setMapBannerDismissed(true)} aria-label="Dismiss">
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="dispatch-map-controls">
            <button type="button" onClick={centerOnMe} title="My location">
              <LocateIcon size={16} />
            </button>
            <button type="button" onClick={fitFleetOnMap} title="Fit fleet" disabled={locatedMembers.length === 0}>
              <MaximizeIcon size={16} />
            </button>
            <button type="button" onClick={refreshFleet} title="Refresh fleet" disabled={fleetRefreshing}>
              <RefreshCwIcon size={16} />
            </button>
          </div>
        </main>

        <aside className="dispatch-sidebar">
          <div className="dispatch-sidebar-tabs">
            <button type="button" className={rightTab === 'jobs' ? 'active' : ''} onClick={() => setRightTab('jobs')}>
              Jobs
              {requestedCount > 0
                ? <span className="tab-badge tab-badge-alert">{requestedCount} new</span>
                : <span className="tab-badge">{activeTrips.length}</span>}
            </button>
            <button type="button" className={rightTab === 'radio' ? 'active' : ''} onClick={() => setRightTab('radio')}>
              Radio<span className="tab-badge">{channels.length}</span>
            </button>
            <button type="button" className={rightTab === 'zones' ? 'active' : ''} onClick={() => setRightTab('zones')}>
              Zones<span className="tab-badge">{zones.length}</span>
            </button>
            <button type="button" className={rightTab === 'alerts' ? 'active' : ''} onClick={() => setRightTab('alerts')}>
              Alerts<span className="tab-badge">{alerts.length}</span>
            </button>
          </div>

          <div className="dispatch-sidebar-content">
            {rightTab === 'jobs' && (
              <>
                <div className="dispatch-card">
                  <div className="dispatch-card-header">
                    <h3>Active Rides</h3>
                    <button type="button" className="dispatch-link-btn" onClick={() => setShowTripForm(v => !v)}>
                      {showTripForm ? 'Cancel' : (<><PlusIcon size={14} /> New ride</>)}
                    </button>
                  </div>
                  {showTripForm && (
                    <form className="dispatch-trip-form" onSubmit={handleCreateTrip}>
                      <div className="dispatch-customer-lookup">
                        <input
                          value={tripForm.customerPhone}
                          onChange={e => {
                            const phone = e.target.value;
                            setTripForm(p => ({ ...p, customerPhone: phone }));
                            setSelectedCustomerId(null);
                            searchCustomers(phone);
                          }}
                          placeholder="Phone (search CRM)"
                          inputMode="tel"
                        />
                        <input
                          value={tripForm.customerName}
                          onChange={e => {
                            const name = e.target.value;
                            setTripForm(p => ({ ...p, customerName: name }));
                            setSelectedCustomerId(null);
                            searchCustomers(name);
                          }}
                          placeholder="Customer name"
                          required
                        />
                        {customerHits.length > 0 && (
                          <ul className="dispatch-customer-hits">
                            {customerHits.map(c => (
                              <li key={c.id}>
                                <button type="button" onClick={() => pickCustomer(c)}>
                                  <strong>{c.name}</strong>
                                  <span>{c.phone} · {c.tripCount} rides</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {customerLookupBusy && <span className="dispatch-broadcast-status">Looking up…</span>}
                        {selectedCustomerId && customerHistory.length > 0 && (
                          <div className="dispatch-customer-history">
                            <span className="dispatch-customer-history-label">Past rides — tap to reuse route</span>
                            {customerHistory.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                className="dispatch-customer-history-item"
                                onClick={() => reusePastRide(t)}
                              >
                                <span className={`dispatch-trip-badge`}>{t.status}</span>
                                <span>{t.pickupAddress} → {t.dropoffAddress}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input value={tripForm.pickupAddress} onChange={e => setTripForm(p => ({ ...p, pickupAddress: e.target.value }))} placeholder="Pickup address" required />
                      <input value={tripForm.dropoffAddress} onChange={e => setTripForm(p => ({ ...p, dropoffAddress: e.target.value }))} placeholder="Dropoff address" required />
                      <select value={tripForm.driverId} onChange={e => setTripForm(p => ({ ...p, driverId: e.target.value }))}>
                        <option value="">Assign later</option>
                        {driverMembers.map(d => (
                          <option key={d.userId} value={d.userId}>{d.user.firstName || d.user.username}</option>
                        ))}
                      </select>
                      <button type="submit" className="dispatch-primary-btn">Create Taxi Ride</button>
                      {tripStatus && <span className="dispatch-broadcast-status">{tripStatus}</span>}
                    </form>
                  )}
                </div>
                {activeTrips.map(trip => (
                  <div key={trip.id} className={`dispatch-trip-row status-${trip.status}`}>
                    <div className="dispatch-trip-info">
                      <span className="dispatch-trip-customer">
                        {trip.customerName}
                        <span className="dispatch-trip-badge taxi">Taxi</span>
                        {trip.bookingSource === 'customer' && <span className="dispatch-trip-badge">App</span>}
                      </span>
                      <span>{trip.pickupAddress} → {trip.dropoffAddress}</span>
                      {trip.customerPhone && <span>{trip.customerPhone}</span>}
                      {trip.estimatedFare != null && <span className="dispatch-trip-fare">{formatMMK(trip.estimatedFare)}{trip.distanceKm != null ? ` · ${trip.distanceKm} km` : ''}</span>}
                      <span>{getTripDriverName(trip)} · {TRIP_STATUS_LABEL[trip.status] || trip.status}</span>
                    </div>
                    <div className="dispatch-trip-actions">
                      {(trip.status === 'pending' || trip.status === 'requested') && (
                        <>
                          <button type="button" className="dispatch-link-btn" onClick={() => handleAutoAssignTrip(trip.id)}>
                            Auto offer
                          </button>
                          <select className="dispatch-trip-assign" defaultValue="" onChange={e => { if (e.target.value) handleAssignTrip(trip.id, e.target.value); }}>
                            <option value="">Assign</option>
                            {driverMembers.map(d => <option key={d.userId} value={d.userId}>{d.user.firstName || d.user.username}</option>)}
                          </select>
                        </>
                      )}
                      {trip.status !== 'pending' && trip.status !== 'requested' && trip.status !== 'assigned' && trip.status !== 'completed' && trip.status !== 'cancelled' && (
                        <button type="button" className="dispatch-link-btn" onClick={() => handleTripStatus(trip.id, 'completed')}>Done</button>
                      )}
                      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                        <button type="button" className="dispatch-cancel-btn" onClick={() => handleTripStatus(trip.id, 'cancelled')}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {activeTrips.length === 0 && !showTripForm && <p className="dispatch-empty">No active rides</p>}
              </>
            )}

            {rightTab === 'radio' && (
              <>
                <div className="dispatch-card">
                  <div className="dispatch-card-header"><h3>Channels</h3></div>
                  {channels.map(ch => (
                    <div key={ch.id} className="dispatch-channel-row">
                      <span>{ch.name}</span>
                      <span>{ch.memberCount} members</span>
                    </div>
                  ))}
                  {channels.length === 0 && <p className="dispatch-empty">No channels</p>}
                </div>
                <div className="dispatch-card">
                  <div className="dispatch-card-header"><h3>Broadcast</h3></div>
                  <form className="dispatch-broadcast-form" onSubmit={handleBroadcast}>
                    <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Message to team..." rows={3} required />
                    <select value={broadcastChannelId} onChange={e => setBroadcastChannelId(e.target.value)}>
                      <option value="">All members</option>
                      {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                    </select>
                    <button type="submit" className="dispatch-primary-btn" disabled={!broadcastMsg.trim()}>Send</button>
                    {broadcastStatus && <span className="dispatch-broadcast-status">{broadcastStatus}</span>}
                  </form>
                </div>
              </>
            )}

            {rightTab === 'zones' && (
              <>
                <div className="dispatch-card">
                  <div className="dispatch-card-header">
                    <h3>Geofence Zones</h3>
                    <button type="button" className="dispatch-link-btn" onClick={() => { setShowZoneForm(v => !v); setPlacingZone(false); }}>
                      {showZoneForm ? 'Cancel' : (<><PlusIcon size={14} /> Add</>)}
                    </button>
                  </div>
                  {showZoneForm && (
                    <form className="dispatch-zone-form" onSubmit={handleCreateZone}>
                      <input value={zoneForm.name} onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))} placeholder="Zone name" required />
                      <div className="dispatch-zone-coords">
                        <input value={zoneForm.latitude} onChange={e => setZoneForm(p => ({ ...p, latitude: e.target.value }))} placeholder="Latitude" required />
                        <input value={zoneForm.longitude} onChange={e => setZoneForm(p => ({ ...p, longitude: e.target.value }))} placeholder="Longitude" required />
                      </div>
                      <button type="button" className="dispatch-secondary-btn" onClick={() => { setPlacingZone(true); setShowZoneForm(false); setRightTab('zones'); }}>
                        Pick on map
                      </button>
                      <input value={zoneForm.radiusMeters} onChange={e => setZoneForm(p => ({ ...p, radiusMeters: e.target.value }))} placeholder="Radius (m)" type="number" min="50" required />
                      <select value={zoneForm.alertOn} onChange={e => setZoneForm(p => ({ ...p, alertOn: e.target.value as typeof zoneForm.alertOn }))}>
                        <option value="both">Enter & exit</option>
                        <option value="enter">Enter only</option>
                        <option value="exit">Exit only</option>
                      </select>
                      <button type="submit" className="dispatch-primary-btn">Save Zone</button>
                      {zoneStatus && <span className="dispatch-broadcast-status">{zoneStatus}</span>}
                    </form>
                  )}
                </div>
                {zones.map(z => (
                  <div key={z.id} className="dispatch-zone-row">
                    <span className="dispatch-zone-dot" style={{ background: z.color }} />
                    <div className="dispatch-zone-info">
                      <span>{z.name}</span>
                      <span>{z.radiusMeters}m · {z.alertOn}</span>
                    </div>
                    <button type="button" className="dispatch-zone-delete" onClick={() => handleDeleteZone(z.id)} aria-label="Delete zone">
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
                {zones.length === 0 && !showZoneForm && <p className="dispatch-empty">No zones yet</p>}
              </>
            )}

            {rightTab === 'alerts' && (
              <>
                {alerts.map(a => (
                  <div key={a.id} className={`dispatch-alert-row ${a.eventType}`}>
                    <span className="dispatch-alert-badge">{a.eventType}</span>
                    <div className="dispatch-alert-info">
                      <span>{getDriverName(a)} · {a.zone?.name || 'Zone'}</span>
                      <span>{formatAlertTime(a.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && <p className="dispatch-empty">No zone alerts yet</p>}
              </>
            )}
          </div>
        </aside>
      </div>

      <footer className="dispatch-footer">
        <span>{user?.firstName || user?.username} · {orgRole}</span>
        <span>{members.filter(m => m.user.isOnline).length} members online</span>
      </footer>
    </div>
  );
}
