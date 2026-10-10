import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { platformAPI } from '../../../services/api';
import { SearchIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import { apiError, formatDateTime, personName, timeAgo, type PlatformUser } from '../platformTypes';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'staff', label: 'Stand staff' },
  { id: 'personal', label: 'Personal' },
  { id: 'admins', label: 'Admins' },
  { id: 'banned', label: 'Suspended' },
];

const PAGE_SIZE = 50;

type Dialog =
  | { kind: 'suspend'; user: PlatformUser }
  | { kind: 'password'; user: PlatformUser; password?: string }
  | null;

const PlatformUsers: React.FC = () => {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformAPI.users({ q: q || undefined, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(apiError(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(0); }, [q, status]);

  const closeDialog = () => {
    setDialog(null);
    setReason('');
    setCopied(false);
  };

  const suspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dialog?.kind !== 'suspend') return;
    setBusy(true);
    setError('');
    try {
      await platformAPI.suspendUser(dialog.user.id, reason.trim());
      setNotice(`${personName(dialog.user)} is suspended.`);
      closeDialog();
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not suspend user'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (u: PlatformUser) => {
    if (!window.confirm(`Restore access for ${personName(u)}?`)) return;
    setBusy(true);
    setError('');
    try {
      await platformAPI.restoreUser(u.id);
      setNotice(`${personName(u)} can sign in again.`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not restore user'));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (dialog?.kind !== 'password') return;
    setBusy(true);
    setError('');
    try {
      const res = await platformAPI.resetUserPassword(dialog.user.id);
      setDialog({ ...dialog, password: res.data?.temporaryPassword });
    } catch (err) {
      setError(apiError(err, 'Could not reset password'));
      closeDialog();
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = async (pw: string) => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Accounts"
        title="Users"
        subtitle={`${total.toLocaleString()} accounts match. Suspend abusive accounts or help people back in with a temporary password.`}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}
      {notice && <div className="fp-pc-notice" role="status">{notice}</div>}

      <div className="fp-pc-toolbar">
        <label className="fp-pc-search">
          <SearchIcon size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, username or phone" />
        </label>
        <div className="fp-pc-segment" role="tablist" aria-label="Filter users">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={status === t.id}
              className={status === t.id ? 'active' : ''}
              onClick={() => setStatus(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead>
              <tr><th>User</th><th>Stands</th><th>Status</th><th>Joined</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {personName(u)}
                      {u.isPlatformAdmin && <span className="fp-pc-pill plan-pro fp-pc-tag">Admin</span>}
                      <span className="fp-pc-sub">{u.phone || '—'} · @{u.username}</span>
                    </td>
                    <td className="fp-pc-wrap">{u.stands || <span className="fp-pc-muted">Personal account</span>}</td>
                    <td>
                      {u.isBanned ? (
                        <>
                          <span className="fp-pc-pill danger">Suspended</span>
                          <span className="fp-pc-sub" title={u.bannedReason}>{u.bannedReason}</span>
                        </>
                      ) : (
                        <>
                          <span className={`fp-pc-pill ${u.isOnline ? 'ok' : 'off'}`}>{u.isOnline ? 'Online' : 'Offline'}</span>
                          <span className="fp-pc-sub">{u.lastSeen ? `Seen ${timeAgo(u.lastSeen)}` : 'Never seen'}</span>
                        </>
                      )}
                    </td>
                    <td>{formatDateTime(u.createdAt)}</td>
                    <td className="fp-pc-right fp-pc-actions">
                      {!(u.isPlatformAdmin && !isMe) && (
                        <button type="button" className="fp-pc-btn small ghost" disabled={busy} onClick={() => setDialog({ kind: 'password', user: u })}>
                          Reset password
                        </button>
                      )}
                      {u.isBanned ? (
                        <button type="button" className="fp-pc-btn small" disabled={busy} onClick={() => restore(u)}>Restore</button>
                      ) : (
                        !u.isPlatformAdmin && !isMe && (
                          <button type="button" className="fp-pc-btn small danger" disabled={busy} onClick={() => setDialog({ kind: 'suspend', user: u })}>
                            Suspend
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && users.length === 0 && <tr><td colSpan={5} className="fp-pc-empty">No users match.</td></tr>}
              {loading && users.length === 0 && <tr><td colSpan={5} className="fp-pc-empty">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {pages > 1 && (
        <div className="fp-pc-pager">
          <button type="button" className="fp-pc-btn small ghost" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className="fp-pc-btn small ghost" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {dialog && (
        <div className="fp-pc-dialog-scrim" role="presentation" onClick={closeDialog}>
          <div className="fp-pc-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {dialog.kind === 'suspend' ? (
              <form onSubmit={suspend}>
                <h2>Suspend {personName(dialog.user)}?</h2>
                <p>Their open sessions stop working within seconds and they can't sign in until you restore them. Their data is kept.</p>
                <label className="fp-pc-field">
                  <span>Reason (saved in the audit log)</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={300}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Fake bookings reported by Hlaing stand"
                    autoFocus
                  />
                </label>
                <div className="fp-pc-form-actions">
                  <button type="button" className="fp-pc-btn ghost" onClick={closeDialog}>Cancel</button>
                  <button type="submit" className="fp-pc-btn danger" disabled={busy || reason.trim().length < 3}>Suspend account</button>
                </div>
              </form>
            ) : dialog.password ? (
              <div>
                <h2>Temporary password</h2>
                <p>Give this to {personName(dialog.user)} privately. It is shown only once — they should change it after signing in.</p>
                <div className="fp-pc-secret">
                  <code>{dialog.password}</code>
                  <button type="button" className="fp-pc-btn small" onClick={() => copyPassword(dialog.password!)}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="fp-pc-form-actions">
                  <button type="button" className="fp-pc-btn" onClick={closeDialog}>Done</button>
                </div>
              </div>
            ) : (
              <div>
                <h2>Reset password for {personName(dialog.user)}?</h2>
                <p>Their current password stops working immediately. You'll get a one-time temporary password to pass on.</p>
                <div className="fp-pc-form-actions">
                  <button type="button" className="fp-pc-btn ghost" onClick={closeDialog}>Cancel</button>
                  <button type="button" className="fp-pc-btn" disabled={busy} onClick={resetPassword}>Reset password</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformUsers;
