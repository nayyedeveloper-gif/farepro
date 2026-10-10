import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MenuIcon, XIcon } from '../icons/Icons';

const NAV_LINKS = [
  { label: 'Industries', path: '/industries' },
  { label: 'Resources', path: '/resources' },
  { label: 'Enterprise', path: '/enterprise' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Contact', path: '/contact' },
];

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="tl-navbar">
      <div className="tl-navbar-inner">
        <Link to="/" className="tl-navbar-brand" aria-label="FarePro home">
          <span className="tl-navbar-mark" aria-hidden="true">FP</span>
          <span>FarePro</span>
        </Link>

        <nav className="tl-navbar-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.path} to={link.path}>{link.label}</Link>
          ))}
        </nav>

        <div className="tl-navbar-actions">
          <button type="button" className="tl-navbar-signin" onClick={() => navigate('/login')}>
            Sign in
          </button>
          <button type="button" className="tl-btn tl-btn-primary tl-btn-sm" onClick={() => navigate('/org/signup')}>
            Create stand
          </button>
        </div>

        <button
          type="button"
          className="tl-navbar-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="tl-navbar-mobile">
          {NAV_LINKS.map((link) => (
            <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <hr />
          <Link to="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
          <Link to="/org/signup" onClick={() => setMobileOpen(false)} className="tl-navbar-mobile-cta">
            Create stand
          </Link>
        </div>
      )}
    </header>
  );
};

export default Navbar;
