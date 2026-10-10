import React, { useCallback, useEffect, useState } from 'react';
import { platformAPI } from '../../../services/api';
import PageHeader from '../PageHeader';
import { apiError, formatDateTime, type HealthStatus, type PlatformHealth } from '../platformTypes';

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Operational',
  degraded: 'Slow',
  down: 'Down',
};

const formatUptime = (sec: number) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const REFRESH_MS = 30000;

const PlatformSystem: React.FC = () => {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformAPI.system();
      setHealth(res.data);
      setError('');
    } catch (err) {
      setError(apiError(err, 'Could not reach the server'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const rt = health?.runtime;

  return (
    <div className="fp-pc-page">
      <PageHeader
        eyebrow="Operations"
        title="System health"
        subtitle={health ? `Checked ${formatDateTime(health.checkedAt)} · refreshes every 30 seconds` : 'Checking services…'}
        actions={<button type="button" className="fp-pc-btn ghost" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Check now'}</button>}
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      {health && (
        <div className={`fp-pc-health-banner ${health.status}`}>
          <span className="fp-pc-health-dot" />
          {health.status === 'ok'
            ? 'All systems operational'
            : health.status === 'degraded'
              ? 'Some services are slow'
              : 'A service is down — calls, routing or data may be affected'}
        </div>
      )}

      <div className="fp-pc-health-grid">
        {health?.checks.map((c) => (
          <section key={c.name} className={`fp-pc-health-card ${c.status}`}>
            <header>
              <h2>{c.name}</h2>
              <span className={`fp-pc-pill health-${c.status}`}>{STATUS_LABEL[c.status]}</span>
            </header>
            <strong>{c.status === 'down' ? '—' : `${c.latencyMs} ms`}</strong>
            <p>{c.detail || 'Responding normally'}</p>
          </section>
        ))}
      </div>

      {health && (
        <div className="fp-pc-kpis">
          <div className="fp-pc-kpi"><span>Accounts</span><strong>{health.stats?.users.toLocaleString() ?? '—'}</strong><em>{health.stats?.bannedUsers ?? 0} suspended</em></div>
          <div className="fp-pc-kpi"><span>Stands</span><strong>{health.stats?.stands.toLocaleString() ?? '—'}</strong><em>{health.stats?.trips.toLocaleString() ?? 0} trips all-time</em></div>
          <div className="fp-pc-kpi"><span>Database size</span><strong>{health.stats?.dbSize ?? '—'}</strong><em>PostgreSQL</em></div>
          <div className="fp-pc-kpi"><span>Server uptime</span><strong>{rt ? formatUptime(rt.uptimeSec) : '—'}</strong><em>since {formatDateTime(rt?.startedAt)}</em></div>
        </div>
      )}

      {rt && (
        <section className="fp-pc-card">
          <header className="fp-pc-card-head"><h2>Server</h2></header>
          <dl className="fp-pc-dl">
            <div><dt>Last deploy</dt><dd>{formatDateTime(rt.deployedAt)}</dd></div>
            <div><dt>Runtime</dt><dd>{rt.goVersion}</dd></div>
            <div><dt>Memory in use</dt><dd>{rt.heapMb} MB</dd></div>
            <div><dt>Active tasks</dt><dd>{rt.goroutines}</dd></div>
            <div>
              <dt>Demo accounts</dt>
              <dd>{rt.demoEnabled ? 'On — public demo logins are shown on sign-in pages' : 'Off'}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
};

export default PlatformSystem;
