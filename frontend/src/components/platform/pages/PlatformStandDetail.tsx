import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { ChevronLeftIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  formatDateTime,
  formatMMK,
  personName,
  PLAN_DRIVER_LIMITS,
  type PlatformDriver,
  type PlatformMember,
  type PlatformTrip,
  type StandLedgerRow,
  timeAgo,
  TRIP_STATUS_LABEL,
} from '../platformTypes';

interface StandOrg {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  industry: string;
  isActive: boolean;
  maxDrivers: number;
  billingBalanceMmk: number;
  fareRatePerKm: number;
  fareMinimum: number;
  bookingEnabled: boolean;
  createdAt: string;
}

interface StandDetail {
  organization: StandOrg;
  members: PlatformMember[];
  drivers: PlatformDriver[];
  trips: PlatformTrip[];
  billing: StandLedgerRow[];
}

type Tab = 'drivers' | 'members' | 'trips' | 'billing';

const PlatformStandDetail: React.FC = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const justCreated = (location.state as { created?: boolean } | null)?.created;
  const [data, setData] = useState<StandDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(justCreated ? 'Stand created. Share the owner phone and password with the stand owner.' : '');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('drivers');
  const [topup, setTopup] = useState('');
  const [topupReason, setTopupReason] = useState('');
  const [walletDraft, setWalletDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await platformAPI.getOrg(id);
      setData(res.data);
    } catch (err) {
      setError(apiError(err, 'Failed to load stand'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(success);
      await load();
    } catch (err) {
      setError(apiError(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="fp-pc-page">
        <Link to="/platform/stands" className="fp-pc-back"><ChevronLeftIcon size={16} /> Stands</Link>
        {error ? <div className="fp-pc-alert">{error}</div> : <p className="fp-pc-empty">Loading…</p>}
      </div>
    );
  }

  const org = data.organization;
  const online = data.drivers.filter((d) => d.isOnline).length;

  const changePlan = (plan: string) =>
    run(() => platformAPI.updateOrg(org.id, { plan, maxDrivers: PLAN_DRIVER_LIMITS[plan] }), `Plan set to ${plan}`);

  const toggleActive = () => {
    if (org.isActive && !window.confirm(`Suspend ${org.name}? Owner, dispatchers and drivers will lose access.`)) return;
    run(() => platformAPI.updateOrg(org.id, { plan: org.plan, isActive: !org.isActive }), org.isActive ? 'Stand suspended' : 'Stand reactivated');
  };

  const addCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(topup, 10);
    if (!amount) return;
    run(async () => {
      await platformAPI.topupOrg(org.id, { amountMmk: amount, reason: topupReason || 'FarePro topup' });
      setTopup('');
      setTopupReason('');
    }, `${formatMMK(amount)} ${amount > 0 ? 'added to' : 'deducted from'} stand credit`);
  };

  const adjustWallet = (d: PlatformDriver) => {
    const amount = parseInt(walletDraft[d.userId] || '', 10);
    if (!amount) return;
    run(async () => {
      await platformAPI.adjustDriverWallet(org.id, d.userId, { amountMmk: amount });
      setWalletDraft((prev) => ({ ...prev, [d.userId]: '' }));
    }, `Wallet updated for ${personName(d)}`);
  };

  return (
    <div className="fp-pc-page">
      <Link to="/platform/stands" className="fp-pc-back"><ChevronLeftIcon size={16} /> Stands</Link>
      <PageHeader
        eyebrow={org.industry === 'transportation' ? 'Kilo Taxi stand' : 'Fleet'}
        title={org.name}
        subtitle={`${org.subdomain}.farepro.app · since ${new Date(org.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <a className="fp-pc-btn ghost" href={`/book/${org.subdomain}`} target="_blank" rel="noreferrer">Booking page</a>
            <button type="button" className={`fp-pc-btn ${org.isActive ? 'danger' : ''}`} disabled={busy} onClick={toggleActive}>
              {org.isActive ? 'Suspend' : 'Reactivate'}
            </button>
          </>
        }
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}
      {notice && <div className="fp-pc-notice" role="status">{notice}</div>}

      <div className="fp-pc-kpis">
        <div className="fp-pc-kpi">
          <span>Status</span>
          <strong className={org.isActive ? 'fp-pc-pos' : 'fp-pc-neg'}>{org.isActive ? 'Active' : 'Suspended'}</strong>
          <em>{org.bookingEnabled ? 'Online booking on' : 'Online booking off'}</em>
        </div>
        <div className="fp-pc-kpi">
          <span>Drivers</span>
          <strong>{data.drivers.length}/{org.maxDrivers}</strong>
          <em>{online} online now</em>
        </div>
        <div className="fp-pc-kpi">
          <span>Fare</span>
          <strong>{formatMMK(org.fareRatePerKm)}/km</strong>
          <em>min {formatMMK(org.fareMinimum)}</em>
        </div>
        <div className="fp-pc-kpi accent">
          <span>Stand credit</span>
          <strong>{formatMMK(org.billingBalanceMmk)}</strong>
          <em>prepaid balance</em>
        </div>
      </div>

      <div className="fp-pc-grid-2">
        <section className="fp-pc-card">
          <header className="fp-pc-card-head"><h2>Plan</h2></header>
          <div className="fp-pc-plan-pick">
            {['free', 'pro', 'enterprise'].map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy || org.plan === p}
                className={org.plan === p ? 'active' : ''}
                onClick={() => changePlan(p)}
              >
                <strong>{p}</strong>
                <span>{PLAN_DRIVER_LIMITS[p]} drivers</span>
              </button>
            ))}
          </div>
        </section>
        <section className="fp-pc-card">
          <header className="fp-pc-card-head"><h2>Add stand credit</h2></header>
          <form className="fp-pc-inline-form" onSubmit={addCredit}>
            <input type="number" step={1000} placeholder="Amount (Ks)" value={topup} onChange={(e) => setTopup(e.target.value)} required />
            <input placeholder="Reference (e.g. KBZPay txn)" value={topupReason} onChange={(e) => setTopupReason(e.target.value)} />
            <button type="submit" className="fp-pc-btn" disabled={busy}>Apply</button>
          </form>
          <p className="fp-pc-hint">Use a negative amount to correct a mistaken topup.</p>
        </section>
      </div>

      <div className="fp-pc-tabs" role="tablist">
        {([
          ['drivers', `Drivers (${data.drivers.length})`],
          ['members', `Team (${data.members.length})`],
          ['trips', `Recent trips (${data.trips.length})`],
          ['billing', 'Credit ledger'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          {tab === 'drivers' && (
            <table className="fp-pc-table">
              <thead>
                <tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Trips</th><th>Wallet</th><th>Adjust wallet</th></tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => (
                  <tr key={d.userId}>
                    <td>{personName(d)}<span className="fp-pc-sub">{d.phone}</span></td>
                    <td>{d.vehiclePlate || '—'}<span className="fp-pc-sub">{d.vehicleModel}</span></td>
                    <td>
                      <span className={`fp-pc-pill ${d.isOnline ? 'ok' : 'off'}`}>{d.isOnline ? 'Online' : 'Offline'}</span>
                      {d.locationAt && <span className="fp-pc-sub">GPS {timeAgo(d.locationAt)}</span>}
                    </td>
                    <td>{d.completedTrips}</td>
                    <td className={d.walletMmk < 0 ? 'fp-pc-neg' : ''}>{formatMMK(d.walletMmk)}</td>
                    <td>
                      <div className="fp-pc-inline-form tight">
                        <input
                          type="number"
                          step={500}
                          placeholder="± Ks"
                          value={walletDraft[d.userId] || ''}
                          onChange={(e) => setWalletDraft((prev) => ({ ...prev, [d.userId]: e.target.value }))}
                        />
                        <button type="button" className="fp-pc-btn small" disabled={busy} onClick={() => adjustWallet(d)}>Apply</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.drivers.length === 0 && (
                  <tr><td colSpan={6} className="fp-pc-empty">No drivers yet. The owner adds drivers from the Owner Portal.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'members' && (
            <table className="fp-pc-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.userId}>
                    <td>{personName(m)}</td>
                    <td>{m.phone || '—'}</td>
                    <td><span className="fp-pc-pill">{m.role}</span></td>
                    <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'trips' && (
            <table className="fp-pc-table">
              <thead><tr><th>When</th><th>Customer</th><th>Route</th><th>Driver</th><th>Fare</th><th>Status</th></tr></thead>
              <tbody>
                {data.trips.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDateTime(t.createdAt)}</td>
                    <td>{t.customerName}<span className="fp-pc-sub">{t.customerPhone}</span></td>
                    <td className="fp-pc-route"><span>{t.pickupAddress}</span><span>{t.dropoffAddress}</span></td>
                    <td>{t.driverName || '—'}</td>
                    <td>{formatMMK(t.actualFare ?? t.estimatedFare)}</td>
                    <td><span className={`fp-pc-pill status-${t.status}`}>{TRIP_STATUS_LABEL[t.status] || t.status}</span></td>
                  </tr>
                ))}
                {data.trips.length === 0 && <tr><td colSpan={6} className="fp-pc-empty">No trips yet.</td></tr>}
              </tbody>
            </table>
          )}

          {tab === 'billing' && (
            <table className="fp-pc-table">
              <thead><tr><th>When</th><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
              <tbody>
                {data.billing.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDateTime(b.createdAt)}</td>
                    <td><span className="fp-pc-pill">{b.entryType}</span></td>
                    <td>{b.reason || '—'}</td>
                    <td className={b.amountMmk < 0 ? 'fp-pc-neg' : 'fp-pc-pos'}>{b.amountMmk > 0 ? '+' : ''}{formatMMK(b.amountMmk)}</td>
                  </tr>
                ))}
                {data.billing.length === 0 && <tr><td colSpan={4} className="fp-pc-empty">No credit movements yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default PlatformStandDetail;
