import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { platformAPI } from '../../../services/api';
import { addTileLayer, fitToLatLngs, setupMapResizeObserver } from '../../../utils/leafletMap';
import { RefreshCwIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  personName,
  type PlatformDriver,
  type PlatformOrg,
  type PlatformTrip,
  timeAgo,
  TRIP_STATUS_LABEL,
} from '../platformTypes';

const REFRESH_MS = 15000;
const STALE_MS = 10 * 60 * 1000;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const driverColor = (d: PlatformDriver) => {
  const stale = !d.locationAt || Date.now() - new Date(d.locationAt).getTime() > STALE_MS;
  if (!d.isOnline || stale) return '#94a3b8';
  if (d.locationStatus === 'busy' || d.locationStatus === 'dnd') return '#f59e0b';
  return '#1f8f6a';
};

const driverIcon = (d: PlatformDriver) =>
  L.divIcon({
    className: 'fp-pc-marker',
    html: `<div class="fp-pc-car" style="--c:${driverColor(d)}"><span>${escapeHtml((d.vehiclePlate || personName(d)).slice(0, 4))}</span></div>`,
    iconSize: [40, 24],
    iconAnchor: [20, 12],
  });

const tripIcon = (t: PlatformTrip) =>
  L.divIcon({
    className: 'fp-pc-marker',
    html: `<div class="fp-pc-pin ${t.status === 'pending' || t.status === 'requested' ? 'open' : 'live'}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const PlatformMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [drivers, setDrivers] = useState<PlatformDriver[]>([]);
  const [trips, setTrips] = useState<PlatformTrip[]>([]);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    platformAPI.listOrgs().then((r) => setOrgs(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [16.8661, 96.1951], zoom: 12, zoomControl: false });
    addTileLayer(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const cleanup = setupMapResizeObserver(map, containerRef.current);
    return () => {
      cleanup();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await platformAPI.liveMap(orgId ? { orgId } : undefined);
      setDrivers(res.data.drivers || []);
      setTrips(res.data.trips || []);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(apiError(err, 'Failed to load live map'));
    }
  }, [orgId]);

  useEffect(() => {
    fittedRef.current = false;
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points: [number, number][] = [];

    drivers.forEach((d) => {
      if (d.lat == null || d.lng == null) return;
      points.push([d.lat, d.lng]);
      L.marker([d.lat, d.lng], { icon: driverIcon(d) })
        .bindPopup(
          `<strong>${escapeHtml(personName(d))}</strong><br/>${escapeHtml(d.orgName)}<br/>` +
            `${escapeHtml(d.vehiclePlate || 'No plate')} · ${escapeHtml(d.phone || '')}<br/>` +
            `<small>${d.isOnline ? 'Online' : 'Offline'} · GPS ${timeAgo(d.locationAt)}</small>`,
        )
        .addTo(layer);
    });

    trips.forEach((t) => {
      if (t.pickupLat == null || t.pickupLng == null) return;
      points.push([t.pickupLat, t.pickupLng]);
      L.marker([t.pickupLat, t.pickupLng], { icon: tripIcon(t) })
        .bindPopup(
          `<strong>${escapeHtml(t.customerName)}</strong> · ${escapeHtml(TRIP_STATUS_LABEL[t.status] || t.status)}<br/>` +
            `${escapeHtml(t.orgName)}<br/>${escapeHtml(t.pickupAddress)} → ${escapeHtml(t.dropoffAddress)}` +
            (t.driverName ? `<br/>Driver: ${escapeHtml(t.driverName)}` : ''),
        )
        .addTo(layer);
    });

    if (!fittedRef.current && points.length > 0) {
      fitToLatLngs(map, points, 14);
      fittedRef.current = true;
    }
  }, [drivers, trips]);

  const counts = useMemo(() => {
    const online = drivers.filter((d) => driverColor(d) !== '#94a3b8').length;
    const open = trips.filter((t) => t.status === 'pending' || t.status === 'requested').length;
    return { online, open, active: trips.length - open };
  }, [drivers, trips]);

  const focus = (lat?: number, lng?: number) => {
    if (lat == null || lng == null) return;
    mapRef.current?.setView([lat, lng], 16);
  };

  return (
    <div className="fp-pc-page fill">
      <PageHeader
        eyebrow="Operations"
        title="Live map"
        subtitle={`Driver GPS and open trips across stands. Refreshes every ${REFRESH_MS / 1000}s${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}.`}
        actions={
          <>
            <select className="fp-pc-select" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Filter by stand">
              <option value="">All stands</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button type="button" className="fp-pc-btn ghost" onClick={load}><RefreshCwIcon size={16} /> Refresh</button>
          </>
        }
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-map-layout">
        <div className="fp-pc-map-wrap">
          <div ref={containerRef} className="fp-pc-map" />
          <div className="fp-pc-map-legend">
            <span><i style={{ background: '#1f8f6a' }} /> Available ({counts.online})</span>
            <span><i style={{ background: '#f59e0b' }} /> Busy</span>
            <span><i style={{ background: '#94a3b8' }} /> Offline / stale</span>
            <span><i className="ring open" /> Waiting ({counts.open})</span>
            <span><i className="ring live" /> On trip ({counts.active})</span>
          </div>
        </div>
        <aside className="fp-pc-map-side">
          <h3>Drivers with GPS ({drivers.length})</h3>
          <ul className="fp-pc-list">
            {drivers.map((d) => (
              <li key={d.userId}>
                <button type="button" onClick={() => focus(d.lat, d.lng)}>
                  <i className="dot" style={{ background: driverColor(d) }} />
                  <span>
                    <strong>{personName(d)}</strong>
                    <small>{d.orgName} · {d.vehiclePlate || 'no plate'} · {timeAgo(d.locationAt)}</small>
                  </span>
                </button>
              </li>
            ))}
            {drivers.length === 0 && <li className="fp-pc-empty">No driver has shared GPS yet.</li>}
          </ul>
          <h3>Open & active trips ({trips.length})</h3>
          <ul className="fp-pc-list">
            {trips.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => focus(t.pickupLat, t.pickupLng)} disabled={t.pickupLat == null}>
                  <i className={`dot status-${t.status}`} />
                  <span>
                    <strong>{t.customerName} · {TRIP_STATUS_LABEL[t.status] || t.status}</strong>
                    <small>{t.orgName} · {t.pickupAddress}</small>
                  </span>
                </button>
              </li>
            ))}
            {trips.length === 0 && <li className="fp-pc-empty">No open trips right now.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default PlatformMap;
