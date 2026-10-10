import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { RefreshCwIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  formatDateTime,
  formatMMK,
  type PlatformOrg,
  type PlatformTrip,
  TRIP_STATUS_LABEL,
} from '../platformTypes';

const STATUS_FILTERS: [string, string][] = [
  ['', 'All'],
  ['open', 'Waiting'],
  ['active', 'On the road'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const PlatformTrips: React.FC = () => {
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [status, setStatus] = useState('');
  const [trips, setTrips] = useState<PlatformTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    platformAPI.listOrgs().then((r) => setOrgs(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformAPI.trips({ orgId: orgId || undefined, status: status || undefined, limit: 300 });
      setTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load trips'));
    } finally {
      setLoading(false);
    }
  }, [orgId, status]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const done = trips.filter((t) => t.status === 'completed');
    return {
      count: trips.length,
      fares: done.reduce((s, t) => s + (t.actualFare ?? t.estimatedFare ?? 0), 0),
      km: done.reduce((s, t) => s + (t.distanceKm || 0), 0),
    };
  }, [trips]);

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Operations"
        title="Trips"
        subtitle={`${totals.count} trips shown · ${formatMMK(totals.fares)} completed fares · ${totals.km.toFixed(1)} km`}
        actions={<button type="button" className="fp-pc-btn ghost" onClick={load}><RefreshCwIcon size={16} /> Refresh</button>}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-toolbar">
        <select className="fp-pc-select" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Filter by stand">
          <option value="">All stands</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="fp-pc-segment" role="tablist">
          {STATUS_FILTERS.map(([value, label]) => (
            <button key={value || 'all'} type="button" className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead>
              <tr><th>When</th><th>Stand</th><th>Customer</th><th>Route</th><th>Driver</th><th>Fare</th><th>Source</th><th>Status</th></tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.createdAt)}</td>
                  <td><Link to={`/platform/stands/${t.orgId}`} className="fp-pc-strong-link">{t.orgName}</Link></td>
                  <td>{t.customerName}<span className="fp-pc-sub">{t.customerPhone}</span></td>
                  <td className="fp-pc-route">
                    <span>{t.pickupAddress}</span>
                    <span>{t.dropoffAddress}</span>
                  </td>
                  <td>{t.driverName || <span className="fp-pc-muted">Unassigned</span>}</td>
                  <td>
                    {formatMMK(t.actualFare ?? t.estimatedFare)}
                    {t.distanceKm != null && <span className="fp-pc-sub">{t.distanceKm.toFixed(1)} km · {t.paymentMethod}</span>}
                  </td>
                  <td><span className="fp-pc-pill">{t.bookingSource}</span></td>
                  <td><span className={`fp-pc-pill status-${t.status}`}>{TRIP_STATUS_LABEL[t.status] || t.status}</span></td>
                </tr>
              ))}
              {!loading && trips.length === 0 && <tr><td colSpan={8} className="fp-pc-empty">No trips match.</td></tr>}
              {loading && <tr><td colSpan={8} className="fp-pc-empty">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlatformTrips;
