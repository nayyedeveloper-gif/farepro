import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { BuildingIcon, TransportIcon, UserIcon, UsersIcon, ChevronRightIcon } from '../icons/Icons';

export interface DemoAccount {
  key: string;
  label: string;
  description: string;
  kind: 'personal' | 'stand';
  role?: string;
  phone: string;
  password: string;
  subdomain?: string;
}

let cached: Promise<DemoAccount[]> | null = null;

function loadDemoAccounts(): Promise<DemoAccount[]> {
  if (!cached) {
    cached = api
      .get('/demo/accounts')
      .then(res => (res.data?.accounts || []) as DemoAccount[])
      .catch(() => []);
  }
  return cached;
}

const ICON: Record<string, React.FC<{ size?: number }>> = {
  owner: BuildingIcon,
  driver: TransportIcon,
  personal1: UserIcon,
  personal2: UsersIcon,
};

interface Props {
  /** Which sign-in form this page hosts; other demo kinds link to their page. */
  kind: 'personal' | 'stand';
  onPick: (account: DemoAccount) => void;
}

const DemoAccounts: React.FC<Props> = ({ kind, onPick }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    let alive = true;
    loadDemoAccounts().then(list => {
      if (!alive) return;
      setAccounts(list);
      const wanted = list.find(a => a.key === searchParams.get('demo') && a.kind === kind);
      if (wanted) {
        setPicked(wanted.key);
        onPick(wanted);
      }
    });
    return () => { alive = false; };
    // Only auto-fill once from the ?demo= link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (accounts.length === 0) return null;

  const ordered = [...accounts].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));

  const choose = (a: DemoAccount) => {
    if (a.kind !== kind) {
      navigate(`${a.kind === 'stand' ? '/org/signin' : '/login'}?demo=${a.key}`);
      return;
    }
    setPicked(a.key);
    onPick(a);
  };

  return (
    <section className="kl-demo" aria-label="Demo accounts">
      <div className="kl-demo-head">
        <strong>Try a demo account</strong>
        <span>Tap to fill in. Shared sandbox — don't enter real data.</span>
      </div>
      <div className="kl-demo-grid">
        {ordered.map(a => {
          const Icon = ICON[a.key] || UserIcon;
          return (
          <button
            key={a.key}
            type="button"
            className={`kl-demo-card ${picked === a.key ? 'active' : ''}`}
            onClick={() => choose(a)}
            aria-pressed={picked === a.key}
          >
            <span className="kl-demo-icon" aria-hidden="true"><Icon size={18} /></span>
            <span className="kl-demo-text">
              <span className="kl-demo-label">{a.label}</span>
              <span className="kl-demo-meta">{a.phone}{a.subdomain ? ` · ${a.subdomain}` : ''}</span>
            </span>
            {a.kind !== kind && <span className="kl-demo-go" aria-hidden="true"><ChevronRightIcon size={16} /></span>}
          </button>
          );
        })}
      </div>
    </section>
  );
};

export default DemoAccounts;
