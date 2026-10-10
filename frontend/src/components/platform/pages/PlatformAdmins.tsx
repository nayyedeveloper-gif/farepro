import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { platformAPI } from '../../../services/api';
import PageHeader from '../PageHeader';
import {
  apiError,
  personName,
  type PlatformAdmin,
} from '../platformTypes';

const PlatformAdmins: React.FC = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await platformAPI.admins();
      setAdmins(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load admins'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await platformAPI.grantAdmin(phone.trim());
      setNotice(`${phone.trim()} is now a platform admin.`);
      setPhone('');
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not grant access'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (a: PlatformAdmin) => {
    if (!window.confirm(`Remove super admin access from ${personName(a)}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await platformAPI.revokeAdmin(a.id);
      setNotice(`Access removed from ${personName(a)}.`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not revoke access'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fp-pc-page narrow">
      <PageHeader
        eyebrow="Security"
        title="Platform admins"
        subtitle="People who can manage every stand, plan and balance on FarePro. Keep this list short."
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}
      {notice && <div className="fp-pc-notice" role="status">{notice}</div>}

      <section className="fp-pc-card">
        <header className="fp-pc-card-head"><h2>Grant access</h2></header>
        <form className="fp-pc-inline-form" onSubmit={grant}>
          <input type="tel" required placeholder="Phone of an existing FarePro account" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button type="submit" className="fp-pc-btn" disabled={busy}>Grant</button>
        </form>
        <p className="fp-pc-hint">The person must already have a FarePro account with this phone number.</p>
      </section>

      <section className="fp-pc-card flush">
        <div className="fp-pc-table-wrap">
          <table className="fp-pc-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Since</th><th /></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{personName(a)}{a.id === user?.id && <span className="fp-pc-sub">You</span>}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="fp-pc-right">
                    {a.id !== user?.id && (
                      <button type="button" className="fp-pc-btn small danger" disabled={busy || admins.length <= 1} onClick={() => revoke(a)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlatformAdmins;
