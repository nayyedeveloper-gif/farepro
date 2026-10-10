import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { platformAPI } from '../../services/api';
import {
  BuildingIcon,
  DatabaseIcon,
  GridIcon,
  HistoryIcon,
  LogOutIcon,
  MapPinIcon,
  MenuIcon,
  RouteIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from '../icons/Icons';
import { personName } from './platformTypes';

const NAV = [
  { to: '/platform', label: 'Overview', icon: GridIcon, end: true },
  { to: '/platform/stands', label: 'Stands', icon: BuildingIcon },
  { to: '/platform/map', label: 'Live map', icon: MapPinIcon },
  { to: '/platform/trips', label: 'Trips', icon: RouteIcon },
  { to: '/platform/drivers', label: 'Drivers', icon: UsersIcon },
  { to: '/platform/billing', label: 'Billing', icon: WalletIcon },
  { to: '/platform/users', label: 'Users', icon: UserIcon },
  { to: '/platform/admins', label: 'Admins', icon: ShieldIcon },
  { to: '/platform/audit', label: 'Audit log', icon: HistoryIcon },
  { to: '/platform/system', label: 'System health', icon: DatabaseIcon },
];

type Access = 'checking' | 'ok' | 'denied' | 'error';

const PlatformLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [access, setAccess] = useState<Access>('checking');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    platformAPI
      .stats()
      .then(() => setAccess('ok'))
      .catch((err) => setAccess(err?.response?.status === 403 ? 'denied' : 'error'));
  }, []);

  if (access === 'checking') {
    return <div className="fp-pc-gate"><p>Checking access…</p></div>;
  }

  if (access !== 'ok') {
    return (
      <div className="fp-pc-gate">
        <div className="fp-pc-gate-card">
          <ShieldIcon size={32} />
          <h1>{access === 'denied' ? 'Super admin only' : 'Console unavailable'}</h1>
          <p>
            {access === 'denied'
              ? 'This account does not have FarePro platform admin access.'
              : 'Could not reach the FarePro API. Try again shortly.'}
          </p>
          <Link to="/" className="fp-pc-btn">Back to FarePro</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`fp-pc ${navOpen ? 'nav-open' : ''}`}>
      <aside className="fp-pc-side">
        <div className="fp-pc-brand">
          <span className="fp-pc-mark">FP</span>
          <div>
            <strong>FarePro</strong>
            <span>Super Admin</span>
          </div>
          <button type="button" className="fp-pc-close" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <XIcon size={18} />
          </button>
        </div>
        <nav className="fp-pc-nav" aria-label="Super admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="fp-pc-me">
          <div className="fp-pc-avatar">{personName(user || {}).charAt(0).toUpperCase()}</div>
          <div className="fp-pc-me-text">
            <strong>{personName(user || {})}</strong>
            <span>{user?.phone || 'Platform admin'}</span>
          </div>
          <button type="button" className="fp-pc-icon-btn" aria-label="Sign out" onClick={logout}>
            <LogOutIcon size={18} />
          </button>
        </div>
      </aside>
      <div className="fp-pc-scrim" onClick={() => setNavOpen(false)} />
      <main className="fp-pc-main">
        <div className="fp-pc-mobilebar">
          <button type="button" className="fp-pc-icon-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <MenuIcon size={20} />
          </button>
          <strong>FarePro Admin</strong>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default PlatformLayout;
