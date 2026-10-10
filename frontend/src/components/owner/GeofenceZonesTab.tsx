import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { orgAPI } from '../../services/api';
import { addTileLayer, getMapCenter, setupMapResizeObserver } from '../../utils/leafletMap';
import { MapPinIcon, RefreshCwIcon } from '../icons/Icons';

export interface GeofenceZone {
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

interface Draft {
  id?: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  alertOn: 'enter' | 'exit' | 'both';
  color: string;
  isActive: boolean;
  channelId: string;
}

interface Props {
  channels: Array<{ id: string; name: string }>;
}

const COLORS = ['#F26522', '#3b82f6', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

const emptyDraft = (): Draft => ({
  name: '',
  latitude: null,
  longitude: null,
  radiusMeters: 300,
  alertOn: 'both',
  color: COLORS[0],
  isActive: true,
  channelId: '',
});

const formatRadius = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export default function GeofenceZonesTab({ channels }: Props) {
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.Circle | null>(null);
  const fittedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await orgAPI.getGeofenceZones();
      setZones(res.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load zones');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([16.8409, 96.1735], 13);
    addTileLayer(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const disconnect = setupMapResizeObserver(map, containerRef.current);
    getMapCenter().then(center => {
      if (!fittedRef.current) map.setView(center, 14);
    }).catch(() => {});
    map.on('click', (e: L.LeafletMouseEvent) => {
      setDraft(d => ({ ...d, latitude: e.latlng.lat, longitude: e.latlng.lng }));
    });
    return () => {
      disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    zones.forEach(z => {
      const circle = L.circle([z.latitude, z.longitude], {
        radius: z.radiusMeters,
        color: z.color || COLORS[1],
        weight: draft.id === z.id ? 3 : 2,
        dashArray: z.isActive ? undefined : '6 6',
        fillOpacity: draft.id === z.id ? 0.08 : 0.15,
      });
      circle.bindTooltip(`${z.name} · ${formatRadius(z.radiusMeters)}`);
      circle.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        setDraft({
          id: z.id,
          name: z.name,
          latitude: z.latitude,
          longitude: z.longitude,
          radiusMeters: z.radiusMeters,
          alertOn: z.alertOn,
          color: z.color || COLORS[1],
          isActive: z.isActive,
          channelId: z.channelId || '',
        });
      });
      circle.addTo(group);
    });
    if (!fittedRef.current && zones.length > 0) {
      fittedRef.current = true;
      const bounds = L.latLngBounds([]);
      zones.forEach(z => bounds.extend(L.latLng(z.latitude, z.longitude).toBounds(z.radiusMeters * 2)));
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      }, 150);
    }
  }, [zones, draft.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (draftLayerRef.current) {
      draftLayerRef.current.remove();
      draftLayerRef.current = null;
    }
    if (draft.latitude == null || draft.longitude == null) return;
    draftLayerRef.current = L.circle([draft.latitude, draft.longitude], {
      radius: draft.radiusMeters,
      color: draft.color,
      weight: 3,
      fillOpacity: 0.25,
      interactive: false,
    }).addTo(map);
  }, [draft.latitude, draft.longitude, draft.radiusMeters, draft.color]);

  const focusZone = (z: GeofenceZone) => {
    mapRef.current?.setView([z.latitude, z.longitude], 15);
    setDraft({
      id: z.id,
      name: z.name,
      latitude: z.latitude,
      longitude: z.longitude,
      radiusMeters: z.radiusMeters,
      alertOn: z.alertOn,
      color: z.color || COLORS[1],
      isActive: z.isActive,
      channelId: z.channelId || '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.latitude == null || draft.longitude == null) {
      setError('Click on the map to place the zone centre');
      return;
    }
    if (!draft.name.trim()) {
      setError('Zone name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: draft.name.trim(),
        latitude: draft.latitude,
        longitude: draft.longitude,
        radiusMeters: Math.round(draft.radiusMeters),
        alertOn: draft.alertOn,
        color: draft.color,
      };
      if (draft.id) {
        await orgAPI.updateGeofenceZone(draft.id, { ...payload, isActive: draft.isActive });
      } else {
        await orgAPI.createGeofenceZone({ ...payload, channelId: draft.channelId || undefined });
      }
      setDraft(emptyDraft());
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save zone');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id || !window.confirm(`Delete zone "${draft.name}"? Alerts history stays.`)) return;
    setBusy(true);
    try {
      await orgAPI.deleteGeofenceZone(draft.id);
      setDraft(emptyDraft());
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete zone');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="owner-tab-content owner-full">
      <div className="owner-page-head">
        <div>
          <h1>Zones</h1>
          <p className="owner-ops-subtitle">Stand areas, no-go zones and pickup hubs · alerts when drivers enter or leave</p>
        </div>
        <button type="button" className="owner-secondary-btn" onClick={load}>
          <RefreshCwIcon size={14} /> Refresh
        </button>
      </div>

      <div className="owner-zones-layout">
        <div className="owner-panel owner-zones-map-panel">
          <div ref={containerRef} className="owner-zones-map" />
          <div className="owner-zones-hint">
            <MapPinIcon size={14} />
            {draft.latitude == null ? 'Click the map to place a new zone' : draft.id ? 'Click the map to move this zone' : 'Adjust radius, name it, then save'}
          </div>
        </div>

        <div className="owner-zones-side">
          <form className="owner-panel owner-zones-form" onSubmit={save}>
            <div className="owner-panel-head">
              <h3>{draft.id ? 'Edit zone' : 'New zone'}</h3>
            </div>
            <div className="owner-zones-fields">
              <label>
                Name
                <input
                  value={draft.name}
                  maxLength={100}
                  placeholder="e.g. SPTS main stand"
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label>
                Radius · <strong>{formatRadius(draft.radiusMeters)}</strong>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={draft.radiusMeters}
                  onChange={e => setDraft(d => ({ ...d, radiusMeters: Number(e.target.value) }))}
                />
              </label>
              <label>
                Alert when driver
                <select value={draft.alertOn} onChange={e => setDraft(d => ({ ...d, alertOn: e.target.value as Draft['alertOn'] }))}>
                  <option value="both">Enters or leaves</option>
                  <option value="enter">Enters</option>
                  <option value="exit">Leaves</option>
                </select>
              </label>
              {!draft.id && channels.length > 0 && (
                <label>
                  Post alerts to channel
                  <select value={draft.channelId} onChange={e => setDraft(d => ({ ...d, channelId: e.target.value }))}>
                    <option value="">Owner alerts only</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </select>
                </label>
              )}
              <div className="owner-zones-colors" role="radiogroup" aria-label="Zone colour">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === c}
                    aria-label={c}
                    className={draft.color === c ? 'active' : ''}
                    style={{ background: c }}
                    onClick={() => setDraft(d => ({ ...d, color: c }))}
                  />
                ))}
              </div>
              {draft.id && (
                <label className="owner-settings-toggle">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))}
                  />
                  <span>Zone active</span>
                </label>
              )}
              {draft.latitude != null && draft.longitude != null && (
                <span className="owner-table-sub">
                  Centre {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
                </span>
              )}
              {error && <div className="owner-topup-error">{error}</div>}
            </div>
            <div className="owner-zones-actions">
              <button type="submit" className="owner-primary-btn" disabled={busy}>
                {draft.id ? 'Save changes' : 'Create zone'}
              </button>
              {(draft.id || draft.latitude != null) && (
                <button type="button" className="owner-secondary-btn" onClick={() => { setDraft(emptyDraft()); setError(''); }}>
                  Cancel
                </button>
              )}
              {draft.id && (
                <button type="button" className="owner-remove-btn" onClick={remove} disabled={busy}>
                  Delete
                </button>
              )}
            </div>
          </form>

          <div className="owner-panel owner-zones-list">
            <div className="owner-panel-head">
              <h3>{zones.length} zone{zones.length === 1 ? '' : 's'}</h3>
            </div>
            {zones.length === 0 ? (
              <div className="owner-topup-empty">No zones yet. Mark your stand, airport or no-go areas.</div>
            ) : (
              <ul>
                {zones.map(z => (
                  <li key={z.id}>
                    <button type="button" className={draft.id === z.id ? 'active' : ''} onClick={() => focusZone(z)}>
                      <span className="owner-zone-dot" style={{ background: z.color || COLORS[1] }} />
                      <span className="owner-zone-name">{z.name}</span>
                      <span className="owner-table-sub">
                        {formatRadius(z.radiusMeters)} · {z.alertOn}{z.isActive ? '' : ' · paused'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
