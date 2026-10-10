import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeOffIcon } from '../icons/Icons';
import AuthShell from './AuthShell';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(formData);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell backTo="/login" backLabel="Sign in">
      <div className="kl-auth-head">
        <h1>Create account</h1>
        <p>For drivers joining a stand, or personal use. Owners should set up a stand instead.</p>
      </div>

      {error && <div className="kl-alert" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="kl-form">
        <div className="kl-form-row">
          <div className="kl-field">
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Aung"
              autoComplete="given-name"
            />
          </div>
          <div className="kl-field">
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Kyaw"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="kl-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
            minLength={3}
            placeholder="aungkyaw"
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="kl-field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="09xxxxxxxxx"
            autoComplete="tel"
          />
        </div>

        <div className="kl-field">
          <label htmlFor="password">Password</label>
          <div className="kl-password">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="At least 6 characters"
              autoComplete="new-password"
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
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="kl-auth-foot">
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="kl-auth-foot-alt">
          Own a taxi stand? <Link to="/org/signup">Create your stand</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default Register;
