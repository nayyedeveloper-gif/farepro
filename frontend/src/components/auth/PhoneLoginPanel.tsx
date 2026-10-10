import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeOffIcon } from '../icons/Icons';
import { getHomeRouteForRole } from '../../utils/orgStorage';
import DemoAccounts, { type DemoAccount } from './DemoAccounts';

const PhoneLoginPanel: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get('return');

  useEffect(() => {
    const notice = sessionStorage.getItem('authNotice');
    if (notice) {
      sessionStorage.removeItem('authNotice');
      setError(notice);
    }
  }, []);

  const fillDemo = (a: DemoAccount) => {
    setPhone(a.phone);
    setPassword(a.password);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(phone, password);
      const dest = returnPath
        ? decodeURIComponent(returnPath)
        : getHomeRouteForRole(result.role || localStorage.getItem('orgRole') || '');
      navigate(dest);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && <div className="kl-alert" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="kl-form">
        <div className="kl-field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="09xxxxxxxxx"
            autoComplete="tel"
            autoFocus
          />
        </div>

        <div className="kl-field">
          <label htmlFor="password">Password</label>
          <div className="kl-password">
            <input
              id="password"
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <DemoAccounts kind="personal" onPick={fillDemo} />
    </>
  );
};

export default PhoneLoginPanel;
