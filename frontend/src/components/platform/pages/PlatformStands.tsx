import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { SearchIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  formatMMK,
  type PlatformOrg,
} from '../platformTypes';

type Filter = 'all' | 'active' | 'suspended' | 'low_credit';

const PlatformStands: React.FC = () => {
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await platformAPI.listOrgs();
      setOrgs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load stands'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (filter === 'active' && !o.isActive) return false;
      if (filter === 'suspended' && o.isActive) return false;
      if (filter === 'low_credit' && o.billingBalanceMmk > 0) return false;
      if (!needle) return true;
      return [o.name, o.subdomain, o.ownerName, o.ownerPhone].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [orgs, q, filter]);

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Manage"
        title="Stands"
        subtitle="Every Kilo Taxi stand and fleet on FarePro."
        actions={<Link to="/platform/stands/new" className="fp-pc-btn">New stand</Link>}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-toolbar">
        <label className="fp-pc-search">
          <SearchIcon size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, subdomain, owner" />
        </label>
        <div className="fp-pc-segment" role="tablist">
          {(['all', 'active', 'suspended', 'low_credit'] as Filter[]).map((f) => (
            <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'low_credit' ? 'No credit' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead>
              <tr>
                <th>Stand</th>
                <th>Owner</th>
                <th>Plan</th>
                <th>Drivers</th>
                <th>Trips</th>
                <th>Credit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className={!o.isActive ? 'is-muted' : ''}>
                  <td>
                    <Link to={`/platform/stands/${o.id}`} className="fp-pc-strong-link">{o.name}</Link>
                    <span className="fp-pc-sub">{o.subdomain}.farepro.app</span>
                  </td>
                  <td>
                    {o.ownerName || '—'}
                    <span className="fp-pc-sub">{o.ownerPhone}</span>
                  </td>
                  <td><span className={`fp-pc-pill plan-${o.plan}`}>{o.plan}</span></td>
                  <td>
                    {o.driverCount}/{o.maxDrivers}
                    <span className="fp-pc-sub">{o.onlineDrivers} online</span>
                  </td>
                  <td>{o.tripCount}</td>
                  <td className={o.billingBalanceMmk <= 0 ? 'fp-pc-neg' : ''}>{formatMMK(o.billingBalanceMmk)}</td>
                  <td>
                    <span className={`fp-pc-pill ${o.isActive ? 'ok' : 'off'}`}>{o.isActive ? 'Active' : 'Suspended'}</span>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="fp-pc-empty">No stands match.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="fp-pc-empty">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlatformStands;
