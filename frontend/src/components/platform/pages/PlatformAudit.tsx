import React, { useCallback, useEffect, useState } from 'react';
import { platformAPI } from '../../../services/api';
import { SearchIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import { apiError, AUDIT_ACTION_LABEL, formatDateTime, type PlatformAuditEntry } from '../platformTypes';

const formatMeta = (meta: Record<string, unknown> | null | undefined) => {
  if (!meta) return '';
  return Object.entries(meta)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
};

const PlatformAudit: React.FC = () => {
  const [entries, setEntries] = useState<PlatformAuditEntry[]>([]);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformAPI.audit({ action: action || undefined, q: q || undefined, limit: 300 });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load audit log'));
    } finally {
      setLoading(false);
    }
  }, [action, q]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        subtitle="Every change a FarePro admin makes to stands, money, admins and accounts — who, what, when and from where."
        actions={<button type="button" className="fp-pc-btn ghost" onClick={load} disabled={loading}>Refresh</button>}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <div className="fp-pc-toolbar">
        <label className="fp-pc-search">
          <SearchIcon size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary or admin" />
        </label>
        <select className="fp-pc-select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead>
              <tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th><th>IP</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="fp-pc-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td>{e.actorName}<span className="fp-pc-sub">{e.actorPhone}</span></td>
                  <td><span className={`fp-pc-pill audit-${e.action.split('.')[0]} ${e.action.split('.')[1] || ''}`}>{AUDIT_ACTION_LABEL[e.action] || e.action}</span></td>
                  <td className="fp-pc-wrap">
                    {e.summary}
                    {formatMeta(e.metadata) && <span className="fp-pc-sub">{formatMeta(e.metadata)}</span>}
                  </td>
                  <td className="fp-pc-muted fp-pc-nowrap">{e.ip || '—'}</td>
                </tr>
              ))}
              {!loading && entries.length === 0 && (
                <tr><td colSpan={5} className="fp-pc-empty">No admin actions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlatformAudit;
