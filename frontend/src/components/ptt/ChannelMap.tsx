import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMapCenter,
  addTileLayer,
  setupMapResizeObserver,
  updateMyLocationMarker,
  fitToLatLngs,
  getCurrentPosition,
} from '../../utils/leafletMap';

export interface ChannelLocation {
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

interface TrailPoint {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  createdAt: string;
}

interface ChannelMapProps {
  channelId: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: '#2d9c78',
  busy: '#f39c12',
  off: '#888',
};

function createDriverIcon(status: string, label: string, heading: number, avatarUrl?: string): L.DivIcon {
  const color = STATUS_COLORS[status] || '#888';
  const rotation = heading ? `transform: rotate(${heading}deg);` : '';
  const inner = avatarUrl
    ? `<img class="ptt-driver-avatar" src="${avatarUrl}" alt="" />`
    : `<span class="ptt-driver-initial">${label}</span>`;
  return L.divIcon({
    className: 'ptt-driver-marker',
    html: `
      <div class="ptt-driver-pin" style="--pin-color: ${color};">
        <div class="ptt-driver-rotate" style="${rotation}">
          <div class="ptt-driver-arrow">▲</div>
          <div class="ptt-driver-label">${inner}</div>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

export default function ChannelMap({ channelId }: ChannelMapProps) {
  const { subscribe } = useSocket();
  const { user } = useAuth();
  const [locations, setLocations] = useState<ChannelLocation[]>([]);
  const [myStatus, setMyStatus] = useState<string>('available');
  const [sharing, setSharing] = useState(false);
  const [showTrails, setShowTrails] = useState(false);
  const [trailLoading, setTrailLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const trailsRef = useRef<Record<string, L.Polyline>>({});
  const watchIdRef = useRef<number | null>(null);
  const statusRef = useRef(myStatus);
  const locationsRef = useRef<ChannelLocation[]>([]);
  const showTrailsRef = useRef(false);
  const hasInitiallyFitted = useRef(false);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const myLocationCoordsRef = useRef<[number, number] | null>(null);

  useEffect(() => { statusRef.current = myStatus; }, [myStatus]);
  useEffect(() => { locationsRef.current = locations; }, [locations]);
  useEffect(() => { showTrailsRef.current = showTrails; }, [showTrails]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await api.get(`/channels/${channelId}/locations`);
      setLocations(res.data);
    } catch (err) {
      console.error('[ChannelMap] Failed to load locations:', err);
    }
  }, [channelId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let disposed = false;
    const container = containerRef.current;

    (async () => {
      const center = await getMapCenter();
      if (disposed || !containerRef.current) return;

      const map = L.map(container, {
        center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
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
      trailsRef.current = {};
      myLocationMarkerRef.current = null;
      hasInitiallyFitted.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub1 = subscribe('channel.location', (data: unknown) => {
      const loc = data as ChannelLocation;
      if (loc.channelId !== channelId) return;
      setLocations(prev => {
        const filtered = prev.filter(l => l.userId !== loc.userId);
        return [...filtered, loc];
      });
    });
    const unsub2 = subscribe('channel.location_cleared', (data: unknown) => {
      const payload = data as { channelId: string; userId: string };
      if (payload.channelId !== channelId) return;
      setLocations(prev => prev.filter(l => l.userId !== payload.userId));
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribe, channelId]);

  const loadTrail = useCallback(async (userId: string) => {
    if (!mapRef.current) return;
    setTrailLoading(true);
    try {
      const res = await api.get(`/channels/${channelId}/locations/trail?userId=${userId}&limit=200`);
      const points = res.data as TrailPoint[];
      const latlngs = points.reverse().map(p => [p.latitude, p.longitude] as [number, number]);

      const map = mapRef.current;
      if (!map) return;

      if (trailsRef.current[userId]) {
        map.removeLayer(trailsRef.current[userId]);
        delete trailsRef.current[userId];
      }

      if (latlngs.length >= 2) {
        const loc = locationsRef.current.find(l => l.userId === userId);
        const color = loc?.status === 'busy' ? '#f39c12' : '#2d9c78';
        const polyline = L.polyline(latlngs, {
          color,
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 8',
        }).addTo(map);
        trailsRef.current[userId] = polyline;
      }
    } catch (err) {
      console.error('[ChannelMap] Failed to load trail:', err);
    } finally {
      setTrailLoading(false);
    }
  }, [channelId]);

  const clearAllTrails = useCallback(() => {
    if (!mapRef.current) return;
    for (const userId of Object.keys(trailsRef.current)) {
      mapRef.current.removeLayer(trailsRef.current[userId]);
      delete trailsRef.current[userId];
    }
  }, []);

  useEffect(() => {
    if (!showTrails) {
      clearAllTrails();
      return;
    }
    const locs = locationsRef.current;
    for (const loc of locs) {
      loadTrail(loc.userId);
    }
  }, [showTrails, loadTrail, clearAllTrails]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentIds = new Set<string>();

    for (const loc of locations) {
      currentIds.add(loc.userId);
      const name = loc.user?.firstName || loc.user?.username || '?';
      const label = loc.userId === user?.id ? 'You' : name.charAt(0).toUpperCase();
      const avatarUrl = loc.user?.avatarUrl || undefined;
      const icon = createDriverIcon(loc.status, label, loc.heading, avatarUrl);

      if (markersRef.current[loc.userId]) {
        markersRef.current[loc.userId].setLatLng([loc.latitude, loc.longitude]);
        markersRef.current[loc.userId].setIcon(icon);
        markersRef.current[loc.userId].setPopupContent(`<b>${name}</b><br>Status: ${loc.status}<br>Speed: ${(loc.speed || 0).toFixed(0)} km/h`);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindPopup(`<b>${name}</b><br>Status: ${loc.status}<br>Speed: ${(loc.speed || 0).toFixed(0)} km/h`);
        const userId = loc.userId;
        marker.on('click', () => {
          if (!showTrailsRef.current) {
            loadTrail(userId);
          }
        });
        markersRef.current[loc.userId] = marker;
      }
    }

    for (const userId of Object.keys(markersRef.current)) {
      if (!currentIds.has(userId)) {
        map.removeLayer(markersRef.current[userId]);
        delete markersRef.current[userId];
      }
    }

    if (!hasInitiallyFitted.current) {
      const points: [number, number][] = locations.map(l => [l.latitude, l.longitude]);
      if (myLocationCoordsRef.current) points.push(myLocationCoordsRef.current);
      if (points.length > 0) {
        fitToLatLngs(map, points, 15);
        hasInitiallyFitted.current = true;
      }
    }
  }, [locations, user, loadTrail]);

  const handleRecenter = async () => {
    if (!mapRef.current) return;
    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      myLocationCoordsRef.current = [lat, lng];
      updateMyLocationMarker(mapRef.current, myLocationMarkerRef, lat, lng);
      mapRef.current.setView([lat, lng], 16);
    } catch (err) {
      console.error('[ChannelMap] Geolocation error:', err);
    }
  };

  const sendLocation = async (lat: number, lng: number, heading: number, speed: number) => {
    try {
      await api.put(`/channels/${channelId}/locations`, {
        latitude: lat,
        longitude: lng,
        heading,
        speed,
        status: statusRef.current,
      });
    } catch (err) {
      console.error('[ChannelMap] Failed to send location:', err);
    }
  };

  const handleStartSharing = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported on this device');
      return;
    }
    setSharing(true);
    setMyStatus('available');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        myLocationCoordsRef.current = [lat, lng];
        if (mapRef.current) {
          updateMyLocationMarker(mapRef.current, myLocationMarkerRef, lat, lng);
        }
        sendLocation(lat, lng, pos.coords.heading || 0, pos.coords.speed || 0);
      },
      (err) => {
        console.error('[ChannelMap] Geolocation error:', err);
        alert('Failed to get location: ' + err.message);
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const handleStopSharing = async () => {
    setSharing(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    try {
      await api.delete(`/channels/${channelId}/locations`);
      setLocations(prev => prev.filter(l => l.userId !== user?.id));
    } catch (err) {
      console.error('[ChannelMap] Failed to clear location:', err);
    }
  };

  const handleClearTrail = async () => {
    try {
      await api.delete(`/channels/${channelId}/locations/trail`);
      clearAllTrails();
    } catch (err) {
      console.error('[ChannelMap] Failed to clear trail:', err);
    }
  };

  const handleStatusChange = async (status: string) => {
    setMyStatus(status);
    if (sharing) {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0, pos.coords.speed || 0),
        undefined,
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  };

  return (
    <div className="ptt-map-container">
      <div className="ptt-map-header">
        <div className="ptt-map-status-toggle">
          <button
            className={`ptt-map-status-btn ${myStatus === 'available' ? 'active available' : ''}`}
            onClick={() => handleStatusChange('available')}
            disabled={!sharing}
          >
            Available
          </button>
          <button
            className={`ptt-map-status-btn ${myStatus === 'busy' ? 'active busy' : ''}`}
            onClick={() => handleStatusChange('busy')}
            disabled={!sharing}
          >
            Busy
          </button>
          <button
            className={`ptt-map-status-btn ${showTrails ? 'active' : ''}`}
            onClick={() => setShowTrails(!showTrails)}
            title="Toggle route trails"
          >
            {trailLoading ? 'Loading...' : 'Trails'}
          </button>
        </div>
        <div className="ptt-map-actions">
          <button
            className="ptt-map-recenter-btn"
            onClick={handleRecenter}
            title="Center on my location"
          >
            My location
          </button>
          <button
            className={`ptt-map-share-btn ${sharing ? 'sharing' : ''}`}
            onClick={sharing ? handleStopSharing : handleStartSharing}
          >
            {sharing ? 'Stop' : 'Share'}
          </button>
        </div>
      </div>
      <div className="ptt-map-wrapper" ref={containerRef} />
      <div className="ptt-map-legend">
        <span className="ptt-map-legend-item"><span className="ptt-legend-dot available" /> Available — {locations.filter(l => l.status === 'available').length}</span>
        <span className="ptt-map-legend-item"><span className="ptt-legend-dot busy" /> Busy — {locations.filter(l => l.status === 'busy').length}</span>
        {showTrails && (
          <button className="ptt-map-clear-trail" onClick={handleClearTrail}>
            Clear My Trail
          </button>
        )}
      </div>
    </div>
  );
}
