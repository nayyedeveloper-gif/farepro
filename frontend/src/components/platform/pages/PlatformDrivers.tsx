import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { SearchIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  formatMMK,
  personName,
  type PlatformDriver,
  type PlatformOrg,
  timeAgo,
} from '../platformTypes';

const PlatformDrivers: React.FC = () => {
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [q, setQ] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [drivers, setDrivers] = useState<PlatformDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    platformAPI.listOrgs().then((r) => setOrgs(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformAPI.drivers({ orgId: orgId || undefined, q: q || undefined, online: onlineOnly || undefined });
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load drivers'));
    } finally {
      setLoading(false);
    }
  }, [orgId, q, onlineOnly]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const negative = drivers.filter((d) => d.walletMmk < 0).length;

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Fleet"
        title="Drivers"
        subtitle={`${drivers.length} drivers · ${drivers.filter((d) => d.isOnline).length} online · ${negative} with negative wallet`}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-toolbar">
        <label className="fp-pc-search">
          <SearchIcon size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or plate" />
        </label>
        <select className="fp-pc-select" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Filter by stand">
          <option value="">All stands</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="fp-pc-check">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          Online only
        </label>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead>
              <tr><th>Driver</th><th>Stand</th><th>Vehicle</th><th>Status</th><th>Completed</th><th>Wallet</th></tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={`${d.orgId}-${d.userId}`}>
                  <td>{personName(d)}<span className="fp-pc-sub">{d.phone}</span></td>
                  <td><Link to={`/platform/stands/${d.orgId}`} className="fp-pc-strong-link">{d.orgName}</Link></td>
                  <td>{d.vehiclePlate || '—'}<span className="fp-pc-sub">{d.vehicleModel}</span></td>
                  <td>
                    <span className={`fp-pc-pill ${d.isOnline ? 'ok' : 'off'}`}>{d.isOnline ? 'Online' : 'Offline'}</span>
                    <span className="fp-pc-sub">{d.locationAt ? `GPS ${timeAgo(d.locationAt)}` : 'No GPS yet'}</span>
                  </td>
                  <td>{d.completedTrips}</td>
                  <td className={d.walletMmk < 0 ? 'fp-pc-neg' : ''}>{formatMMK(d.walletMmk)}</td>
                </tr>
              ))}
              {!loading && drivers.length === 0 && <tr><td colSpan={6} className="fp-pc-empty">No drivers match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="fp-pc-hint">Adjust a driver wallet from the driver's stand page.</p>
    </div>
  );
};

export default PlatformDrivers;
