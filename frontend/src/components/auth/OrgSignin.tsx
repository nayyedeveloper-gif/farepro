import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeOffIcon } from '../icons/Icons';
import { getHomeRouteForRole, saveOrgContext } from '../../utils/orgStorage';
import AuthShell from './AuthShell';
import DemoAccounts, { type DemoAccount } from './DemoAccounts';

const OrgSignin: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [subdomain, setSubdomain] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fillDemo = (a: DemoAccount) => {
    setSubdomain(a.subdomain || '');
    setPhone(a.phone);
    setPassword(a.password);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!subdomain || !phone || !password) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await orgAPI.login({ phone, password }, subdomain);
      const { token, user, organization, role } = res.data;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('org');
      localStorage.removeItem('orgRole');
      setAuth(token, user);
      saveOrgContext(organization, role, token);
      navigate(getHomeRouteForRole(role));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell backTo="/login" backLabel="Sign in">
      <div className="kl-auth-head">
        <h1>Open your stand</h1>
        <p>Owners, dispatchers, and drivers — enter your stand code and phone.</p>
      </div>

      {error && <div className="kl-alert" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="kl-form">
        <div className="kl-field">
          <label htmlFor="stand">Stand code</label>
          <div className="kl-subdomain">
            <input
              id="stand"
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              placeholder="yourstand"
              autoComplete="organization"
              autoFocus
            />
            <span>.farepro.app</span>
          </div>
        </div>

        <div className="kl-field">
          <label htmlFor="org-phone">Phone</label>
          <input
            id="org-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="09xxxxxxxxx"
            autoComplete="tel"
          />
        </div>

        <div className="kl-field">
          <label htmlFor="org-password">Password</label>
          <div className="kl-password">
            <input
              id="org-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="kl-submit" disabled={loading}>
          {loading ? 'Opening…' : 'Open stand'}
        </button>
      </form>

      <DemoAccounts kind="stand" onPick={fillDemo} />

      <div className="kl-auth-foot">
        <p>
          New stand? <Link to="/org/signup">Create one</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default OrgSignin;
