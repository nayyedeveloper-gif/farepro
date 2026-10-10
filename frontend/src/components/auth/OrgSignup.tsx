import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getHomeRouteForRole, saveOrgContext } from '../../utils/orgStorage';
import { EyeIcon, EyeOffIcon, CheckIcon, MicIcon, MapPinIcon, PhoneIcon } from '../icons/Icons';
import { INDUSTRY_TEMPLATES, type IndustryTemplate } from '../../constants/industryTemplates';
import AuthShell from './AuthShell';

const STEPS = ['Stand type', 'Stand details', 'Owner account'] as const;

const OrgSignup: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    ownerName: '',
    ownerPhone: '',
    password: '',
    industry: 'transportation',
  });
  const [templates, setTemplates] = useState<IndustryTemplate[]>(INDUSTRY_TEMPLATES);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const subdomainTimer = useRef<number | null>(null);

  useEffect(() => {
    orgAPI.getIndustryTemplates()
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setTemplates(res.data);
        }
      })
      .catch(() => { /* keep built-in */ });
  }, []);

  useEffect(() => {
    return () => {
      if (subdomainTimer.current) window.clearTimeout(subdomainTimer.current);
    };
  }, []);

  const selectedTemplate = templates.find((t) => t.id === formData.industry) || templates[0];

  const checkSubdomain = async (value: string) => {
    if (value.length < 2) {
      setSubdomainStatus('idle');
      return;
    }
    setSubdomainStatus('checking');
    try {
      const res = await orgAPI.checkSubdomain(value);
      setSubdomainStatus(res.data.available ? 'available' : 'taken');
    } catch {
      setSubdomainStatus('idle');
    }
  };

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, subdomain: value }));
    setSubdomainStatus('idle');
    if (subdomainTimer.current) window.clearTimeout(subdomainTimer.current);
    subdomainTimer.current = window.setTimeout(() => checkSubdomain(value), 400);
  };

  const canContinueStep0 = Boolean(formData.industry);
  const canContinueStep1 =
    formData.name.trim().length >= 2 &&
    formData.subdomain.length >= 2 &&
    subdomainStatus === 'available';
  const canSubmit =
    formData.ownerName.trim().length >= 2 &&
    formData.ownerPhone.trim().length >= 6 &&
    formData.password.length >= 6;

  const goNext = () => {
    setError('');
    if (step === 0 && !canContinueStep0) return;
    if (step === 1 && !canContinueStep1) {
      setError(subdomainStatus === 'taken' ? 'That stand code is taken' : 'Enter a stand name and available code');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    if (step === 0) {
      navigate('/login');
      return;
    }
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      setError('Fill in your name, phone, and password');
      return;
    }
    if (subdomainStatus !== 'available') {
      setError('Stand code is not available');
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      const res = await orgAPI.signup(formData);
      const { token, user, organization } = res.data;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('org');
      localStorage.removeItem('orgRole');
      setAuth(token, user);
      saveOrgContext(organization, 'owner', token);
      navigate(getHomeRouteForRole('owner'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell wide onBack={goBack} backLabel={step === 0 ? 'Sign in' : 'Back'}>
      <div className="kl-auth-head">
        <p className="kl-eyebrow">For Kilo Taxi founders &amp; owners</p>
        <h1>Create your stand</h1>
        <p>Dispatch radio, driver channels, and live ops — ready in under a minute.</p>
      </div>

      <ol className="kl-steps" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'is-active' : i < step ? 'is-done' : ''}>
            <span className="kl-steps-num">{i + 1}</span>
            <span className="kl-steps-label">{label}</span>
          </li>
        ))}
      </ol>

      {error && <div className="kl-alert" role="alert">{error}</div>}

      {step === 0 && (
        <div className="kl-step-body">
          <div className="kl-industry-list" role="radiogroup" aria-label="Stand type">
            {templates.map((tpl) => {
              const isTaxi = tpl.id === 'transportation';
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={formData.industry === tpl.id}
                  className={`kl-industry${formData.industry === tpl.id ? ' is-selected' : ''}${isTaxi ? ' is-featured' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, industry: tpl.id }))}
                >
                  {isTaxi && <span className="kl-industry-badge">Recommended</span>}
                  <strong>{isTaxi ? 'Kilo Taxi stand' : tpl.name}</strong>
                  <span>{tpl.description}</span>
                  {isTaxi && (
                    <ul className="kl-industry-perks">
                      <li><MicIcon size={14} /> Instant PTT dispatch</li>
                      <li><MapPinIcon size={14} /> Live driver map</li>
                      <li><PhoneIcon size={14} /> Encrypted stand calls</li>
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
          <button type="button" className="kl-submit" onClick={goNext} disabled={!canContinueStep0}>
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="kl-step-body">
          {selectedTemplate && (
            <div className="kl-channel-preview">
              <p>Channels we’ll create for you</p>
              <div className="kl-channel-chips">
                {selectedTemplate.channels.map((c) => (
                  <span key={c.name}>{c.name}</span>
                ))}
              </div>
            </div>
          )}

          <div className="kl-form">
            <div className="kl-field">
              <label htmlFor="org-name">Stand name</label>
              <input
                id="org-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                minLength={2}
                placeholder="Your stand name"
                autoComplete="organization"
                autoFocus
              />
            </div>

            <div className="kl-field">
              <label htmlFor="org-code">Stand code</label>
              <div className="kl-subdomain">
                <input
                  id="org-code"
                  type="text"
                  value={formData.subdomain}
                  onChange={handleSubdomainChange}
                  required
                  minLength={2}
                  placeholder="yourstand"
                />
                <span>.farepro.app</span>
              </div>
              {subdomainStatus === 'available' && (
                <span className="kl-hint ok"><CheckIcon size={14} /> Available</span>
              )}
              {subdomainStatus === 'taken' && (
                <span className="kl-hint bad">Taken — try another</span>
              )}
              {subdomainStatus === 'checking' && (
                <span className="kl-hint">Checking…</span>
              )}
            </div>
          </div>

          <button type="button" className="kl-submit" onClick={goNext} disabled={!canContinueStep1}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="kl-step-body">
          <div className="kl-form">
            <div className="kl-field">
              <label htmlFor="owner-name">Your name</label>
              <input
                id="owner-name"
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                required
                minLength={2}
                placeholder="U Ko Ko"
                autoComplete="name"
                autoFocus
              />
            </div>

            <div className="kl-field">
              <label htmlFor="owner-phone">Phone</label>
              <input
                id="owner-phone"
                type="tel"
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                required
                placeholder="09xxxxxxxxx"
                autoComplete="tel"
              />
            </div>

            <div className="kl-field">
              <label htmlFor="owner-password">Password</label>
              <div className="kl-password">
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          </div>

          <button type="submit" className="kl-submit" disabled={loading || !canSubmit}>
            {loading ? 'Creating stand…' : 'Launch stand'}
          </button>
        </form>
      )}

      <div className="kl-auth-foot">
        <p>
          Already have a stand? <Link to="/org/signin">Open it</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default OrgSignup;
