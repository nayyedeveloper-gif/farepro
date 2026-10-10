import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { RefreshCwIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  formatDateTime,
  formatMMK,
  type StandLedgerRow,
  type WalletLedgerRow,
} from '../platformTypes';

type Tab = 'stand' | 'wallet';

const isDebit = (r: WalletLedgerRow) => r.entryType === 'debit' || r.entryType === 'commission';
const walletSigned = (r: WalletLedgerRow) => (isDebit(r) ? -Math.abs(r.amountMmk) : r.amountMmk);

const PlatformBilling: React.FC = () => {
  const [stand, setStand] = useState<StandLedgerRow[]>([]);
  const [wallet, setWallet] = useState<WalletLedgerRow[]>([]);
  const [tab, setTab] = useState<Tab>('stand');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformAPI.billing();
      setStand(res.data.standLedger || []);
      setWallet(res.data.walletLedger || []);
    } catch (err) {
      setError(apiError(err, 'Failed to load billing'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const credited = stand.filter((r) => r.amountMmk > 0).reduce((s, r) => s + r.amountMmk, 0);
  const commission = wallet
    .filter((r) => isDebit(r) && r.reason.startsWith('trip:'))
    .reduce((s, r) => s + Math.abs(r.amountMmk), 0);

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Money"
        title="Billing"
        subtitle="Stand credit topups and driver wallet movements (commission, topups, adjustments)."
        actions={<button type="button" className="fp-pc-btn ghost" onClick={load}><RefreshCwIcon size={16} /> Refresh</button>}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-kpis three">
        <div className="fp-pc-kpi accent">
          <span>Stand credit added</span>
          <strong>{formatMMK(credited)}</strong>
          <em>last {stand.length} entries</em>
        </div>
        <div className="fp-pc-kpi">
          <span>Trip commission</span>
          <strong>{formatMMK(commission)}</strong>
          <em>collected from driver wallets</em>
        </div>
        <div className="fp-pc-kpi">
          <span>Wallet movements</span>
          <strong>{wallet.length}</strong>
          <em>recent entries</em>
        </div>
      </div>

      <div className="fp-pc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'stand'} className={tab === 'stand' ? 'active' : ''} onClick={() => setTab('stand')}>
          Stand credit
        </button>
        <button type="button" role="tab" aria-selected={tab === 'wallet'} className={tab === 'wallet' ? 'active' : ''} onClick={() => setTab('wallet')}>
          Driver wallets
        </button>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          {tab === 'stand' ? (
            <table className="fp-pc-table">
              <thead><tr><th>When</th><th>Stand</th><th>Type</th><th>Reference</th><th>By</th><th>Amount</th></tr></thead>
              <tbody>
                {stand.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.createdAt)}</td>
                    <td><Link to={`/platform/stands/${r.orgId}`} className="fp-pc-strong-link">{r.orgName}</Link></td>
                    <td><span className="fp-pc-pill">{r.entryType}</span></td>
                    <td>{r.reason || '—'}</td>
                    <td>{r.actorName || '—'}</td>
                    <td className={r.amountMmk < 0 ? 'fp-pc-neg' : 'fp-pc-pos'}>{r.amountMmk > 0 ? '+' : ''}{formatMMK(r.amountMmk)}</td>
                  </tr>
                ))}
                {!loading && stand.length === 0 && <tr><td colSpan={6} className="fp-pc-empty">No stand topups yet.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="fp-pc-table">
              <thead><tr><th>When</th><th>Stand</th><th>Driver</th><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
              <tbody>
                {wallet.map((r) => {
                  const signed = walletSigned(r);
                  return (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td><Link to={`/platform/stands/${r.orgId}`} className="fp-pc-strong-link">{r.orgName}</Link></td>
                      <td>{r.driverName}</td>
                      <td><span className="fp-pc-pill">{r.reason.startsWith('trip:') ? 'commission' : r.entryType}</span></td>
                      <td>{r.reason.startsWith('trip:') ? `Trip ${r.reason.slice(5, 13)}` : r.reason || '—'}</td>
                      <td className={signed < 0 ? 'fp-pc-neg' : 'fp-pc-pos'}>{signed > 0 ? '+' : ''}{formatMMK(signed)}</td>
                    </tr>
                  );
                })}
                {!loading && wallet.length === 0 && <tr><td colSpan={6} className="fp-pc-empty">No wallet movements yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default PlatformBilling;
