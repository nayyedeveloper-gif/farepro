import { useCallback, useEffect, useState } from 'react';
import { orgAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import { RefreshCwIcon } from '../icons/Icons';

export interface TopupRequest {
  id: string;
  userId: string;
  driverName: string;
  phone: string;
  amountMmk: number;
  method: string;
  reference: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string;
  reviewedAt?: string;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  kbzpay: 'KBZPay',
  wavepay: 'WavePay',
  ayapay: 'AYA Pay',
  cbpay: 'CB Pay',
  bank: 'Bank transfer',
  cash: 'Cash',
};

type Filter = 'pending' | 'approved' | 'rejected' | '';

interface Props {
  onReviewed?: () => void;
}

export default function TopupRequestsPanel({ onReviewed }: Props) {
  const { subscribe } = useSocket();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgAPI.getTopupRequests(filter);
      setRows(res.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load top-up requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsubA = subscribe('wallet.topup_requested', () => load());
    const unsubB = subscribe('wallet.topup_reviewed', () => load());
    return () => { unsubA(); unsubB(); };
  }, [subscribe, load]);

  const review = async (row: TopupRequest, approve: boolean) => {
    let note = '';
    if (!approve) {
      const reason = window.prompt(`Reject ${row.amountMmk.toLocaleString()} Ks from ${row.driverName}? Reason (shown to driver):`, '');
      if (reason === null) return;
      note = reason;
    } else if (!window.confirm(
      `Credit ${row.amountMmk.toLocaleString()} Ks to ${row.driverName}?\n\nOnly approve after you see this ${METHOD_LABEL[row.method] || row.method} payment${row.reference ? ` (ref ${row.reference})` : ''} in your account.`,
    )) {
      return;
    }
    setBusyId(row.id);
    try {
      if (approve) await orgAPI.approveTopupRequest(row.id, note);
      else await orgAPI.rejectTopupRequest(row.id, note);
      await load();
      onReviewed?.();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to review request');
      load();
    } finally {
      setBusyId('');
    }
  };

  const pendingTotal = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amountMmk, 0);

  return (
    <div className="owner-panel owner-topup-panel">
      <div className="owner-panel-head owner-topup-head">
        <div>
          <h3>Top-up requests</h3>
          <span className="owner-table-sub">
            Drivers pay via KBZPay / WavePay and submit the transaction ID. Verify in your account, then approve.
          </span>
        </div>
        <div className="owner-topup-filters">
          {(['pending', 'approved', 'rejected', ''] as Filter[]).map(f => (
            <button
              key={f || 'all'}
              type="button"
              className={`owner-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f ? f[0].toUpperCase() + f.slice(1) : 'All'}
            </button>
          ))}
          <button type="button" className="owner-secondary-btn" onClick={load} disabled={loading} aria-label="Refresh top-ups">
            <RefreshCwIcon size={14} />
          </button>
        </div>
      </div>
      <div className="owner-panel-body">
        {error && <div className="owner-topup-error">{error}</div>}
        {rows.length === 0 ? (
          <div className="owner-topup-empty">
            {loading ? 'Loading…' : filter === 'pending' ? 'No pending top-ups. New requests appear here instantly.' : 'No requests'}
          </div>
        ) : (
          <table className="owner-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Submitted</th>
                <th className="num">Amount</th>
                <th className="num">{filter === 'pending' ? 'Review' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="owner-table-title">{r.driverName || 'Driver'}</span>
                    <span className="owner-table-sub">{r.phone}</span>
                  </td>
                  <td><span className={`owner-pay-method ${r.method}`}>{METHOD_LABEL[r.method] || r.method}</span></td>
                  <td>
                    <code className="owner-topup-ref">{r.reference || '—'}</code>
                    {r.note && <span className="owner-table-sub">{r.note}</span>}
                  </td>
                  <td>
                    <span className="owner-table-sub">{new Date(r.createdAt).toLocaleString()}</span>
                  </td>
                  <td className="num owner-wallet-amount">{r.amountMmk.toLocaleString()} Ks</td>
                  <td className="num">
                    {r.status === 'pending' ? (
                      <div className="owner-table-actions">
                        <button
                          type="button"
                          className="owner-primary-btn"
                          disabled={busyId === r.id}
                          onClick={() => review(r, true)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="owner-secondary-btn"
                          disabled={busyId === r.id}
                          onClick={() => review(r, false)}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`owner-topup-status ${r.status}`}>{r.status}</span>
                        {r.reviewNote && <span className="owner-table-sub">{r.reviewNote}</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filter === 'pending' && pendingTotal > 0 && (
          <div className="owner-topup-total">Pending total: <strong>{pendingTotal.toLocaleString()} Ks</strong></div>
        )}
      </div>
    </div>
  );
}
