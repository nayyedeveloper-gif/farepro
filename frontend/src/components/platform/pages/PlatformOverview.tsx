import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { RefreshCwIcon } from '../../icons/Icons';
import {
  apiError,
  type DailyPoint,
  formatMMK,
  type PlatformOrg,
  type PlatformOverview as Overview,
} from '../platformTypes';
import PageHeader from '../PageHeader';

const TrendChart: React.FC<{ series: DailyPoint[] }> = ({ series }) => {
  const max = Math.max(1, ...series.map((p) => p.trips));
  return (
    <div className="fp-pc-chart" role="img" aria-label="Trips per day, last 14 days">
      {series.map((p) => (
        <div key={p.day} className="fp-pc-chart-col" title={`${p.day}: ${p.trips} trips, ${p.completed} completed, ${formatMMK(p.revenueMmk)}`}>
          <div className="fp-pc-chart-bar" style={{ height: `${(p.trips / max) * 100}%` }}>
            <div className="fp-pc-chart-done" style={{ height: p.trips ? `${(p.completed / p.trips) * 100}%` : 0 }} />
          </div>
          <span>{p.day.slice(8)}</span>
        </div>
      ))}
    </div>
  );
};

const PlatformOverview: React.FC = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [o, list] = await Promise.all([platformAPI.overview(), platformAPI.listOrgs()]);
      setOverview(o.data.overview);
      setSeries(o.data.series || []);
      setOrgs(Array.isArray(list.data) ? list.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load overview'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowCredit = orgs.filter((o) => o.isActive && o.billingBalanceMmk <= 0);
  const topStands = [...orgs].sort((a, b) => b.tripCount - a.tripCount).slice(0, 6);
  const weekRevenue = series.slice(-7).reduce((sum, p) => sum + p.revenueMmk, 0);

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        subtitle="Live health of every Kilo Taxi stand on FarePro."
        actions={
          <>
            <button type="button" className="fp-pc-btn ghost" onClick={load} disabled={loading}>
              <RefreshCwIcon size={16} /> Refresh
            </button>
            <Link to="/platform/stands/new" className="fp-pc-btn">New stand</Link>
          </>
        }
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      {overview && (
        <div className="fp-pc-kpis">
          <div className="fp-pc-kpi">
            <span>Stands</span>
            <strong>{overview.stands}</strong>
            <em>{overview.activeStands} active</em>
          </div>
          <div className="fp-pc-kpi">
            <span>Drivers online</span>
            <strong>{overview.onlineDrivers}</strong>
            <em>of {overview.drivers} drivers</em>
          </div>
          <div className="fp-pc-kpi">
            <span>Trips today</span>
            <strong>{overview.tripsToday}</strong>
            <em>{overview.activeTrips} on the road now</em>
          </div>
          <div className="fp-pc-kpi accent">
            <span>Fares today</span>
            <strong>{formatMMK(overview.revenueTodayMmk)}</strong>
            <em>{overview.completedToday} completed</em>
          </div>
          <div className="fp-pc-kpi">
            <span>Stand credit</span>
            <strong>{formatMMK(overview.standCreditMmk)}</strong>
            <em>held across all stands</em>
          </div>
          <div className="fp-pc-kpi">
            <span>Driver wallets</span>
            <strong>{formatMMK(overview.driverWalletMmk)}</strong>
            <em>{overview.totalTrips} trips all-time</em>
          </div>
        </div>
      )}

      <div className="fp-pc-grid-2">
        <section className="fp-pc-card">
          <header className="fp-pc-card-head">
            <h2>Trips, last 14 days</h2>
            <span className="fp-pc-muted">{formatMMK(weekRevenue)} fares in 7 days</span>
          </header>
          {series.length > 0 ? <TrendChart series={series} /> : <p className="fp-pc-empty">No trip data yet</p>}
          <div className="fp-pc-legend">
            <span><i className="all" /> Booked</span>
            <span><i className="done" /> Completed</span>
          </div>
        </section>

        <section className="fp-pc-card">
          <header className="fp-pc-card-head">
            <h2>Needs attention</h2>
          </header>
          {lowCredit.length === 0 ? (
            <p className="fp-pc-empty">All active stands have credit.</p>
          ) : (
            <ul className="fp-pc-list">
              {lowCredit.map((o) => (
                <li key={o.id}>
                  <Link to={`/platform/stands/${o.id}`}>
                    <strong>{o.name}</strong>
                    <span className="fp-pc-pill warn">{formatMMK(o.billingBalanceMmk)} credit</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="fp-pc-card">
        <header className="fp-pc-card-head">
          <h2>Top stands</h2>
          <Link to="/platform/stands" className="fp-pc-link">All stands</Link>
        </header>
        {topStands.length === 0 && !loading ? (
          <p className="fp-pc-empty">
            No stands yet. <Link to="/platform/stands/new" className="fp-pc-link">Create the first one</Link>
          </p>
        ) : (
          <div className="fp-pc-table-wrap">
            <table className="fp-pc-table">
              <thead>
                <tr>
                  <th>Stand</th>
                  <th>Plan</th>
                  <th>Drivers online</th>
                  <th>Trips</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {topStands.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/platform/stands/${o.id}`} className="fp-pc-strong-link">{o.name}</Link>
                      <span className="fp-pc-sub">{o.subdomain}.farepro.app</span>
                    </td>
                    <td><span className={`fp-pc-pill plan-${o.plan}`}>{o.plan}</span></td>
                    <td>{o.onlineDrivers}/{o.driverCount}</td>
                    <td>{o.tripCount}</td>
                    <td>{formatMMK(o.billingBalanceMmk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default PlatformOverview;
