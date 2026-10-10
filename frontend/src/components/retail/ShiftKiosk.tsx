import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { syncOrgContext } from '../../utils/orgStorage';
import { BrandMark } from '../brand/BrandMark';

interface RetailShift {
  id: string;
  locationName: string;
  roleLabel: string;
  status: string;
  clockIn: string;
  clockOut?: string;
}

const ROLE_OPTIONS = ['cashier', 'stockroom', 'sales floor', 'manager', 'staff'];

export default function ShiftKiosk() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shift, setShift] = useState<RetailShift | null>(null);
  const [locationName, setLocationName] = useState('');
  const [roleLabel, setRoleLabel] = useState('staff');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const ctx = await syncOrgContext();
      if (cancelled) return;
      if (!ctx.hasOrg) {
        navigate('/org/signin');
        return;
      }
      try {
        const orgRes = await orgAPI.getOrg();
        setOrgName(orgRes.data?.name || '');
        const shiftRes = await orgAPI.getMyShift();
        if (shiftRes.data) setShift(shiftRes.data);
      } catch {
        setError('Failed to load shift status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await orgAPI.clockIn({
        locationName: locationName.trim(),
        roleLabel,
      });
      setShift(res.data);
      setLocationName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Clock in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setError('');
    try {
      await orgAPI.clockOut();
      setShift(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Clock out failed');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="shift-kiosk">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="shift-kiosk">
      <header className="shift-kiosk-header">
        <BrandMark size={44} />
        <div>
          <h1>Shift Kiosk</h1>
          <span>{orgName}</span>
        </div>
        <button type="button" onClick={() => navigate('/app')}>Open App</button>
      </header>

      <main className="shift-kiosk-main">
        <p className="shift-kiosk-greeting">
          Hello, {user?.firstName || user?.username}
        </p>

        {error && <div className="shift-kiosk-error">{error}</div>}

        {shift ? (
          <div className="shift-kiosk-active">
            <span className="shift-kiosk-badge">On Shift</span>
            <h2>{shift.locationName}</h2>
            <p>{shift.roleLabel} · since {formatTime(shift.clockIn)}</p>
            <button
              type="button"
              className="shift-kiosk-clockout"
              onClick={handleClockOut}
              disabled={actionLoading}
            >
              {actionLoading ? 'Clocking out...' : 'Clock Out'}
            </button>
          </div>
        ) : (
          <form className="shift-kiosk-form" onSubmit={handleClockIn}>
            <label>Store / Location</label>
            <input
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              placeholder="Store #12, Main Floor..."
              required
              autoFocus
            />
            <label>Role</label>
            <select value={roleLabel} onChange={e => setRoleLabel(e.target.value)}>
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="submit" className="shift-kiosk-clockin" disabled={actionLoading}>
              {actionLoading ? 'Clocking in...' : 'Clock In'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
