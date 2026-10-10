import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformAPI } from '../../../services/api';
import { ChevronLeftIcon } from '../../icons/Icons';
import PageHeader from '../PageHeader';
import {
  apiError,
  PLAN_DRIVER_LIMITS,
} from '../platformTypes';

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const PlatformCreateStand: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    ownerName: '',
    ownerPhone: '',
    password: '',
    industry: 'transportation',
    plan: 'free',
  });
  const [subTouched, setSubTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !subTouched) next.subdomain = slugify(value);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await platformAPI.createOrg({
        ...form,
        subdomain: slugify(form.subdomain),
        maxDrivers: PLAN_DRIVER_LIMITS[form.plan],
      });
      navigate(`/platform/stands/${res.data.organization.id}`, { state: { created: true } });
    } catch (err) {
      setError(apiError(err, 'Could not create stand'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fp-pc-page narrow">
      <Link to="/platform/stands" className="fp-pc-back"><ChevronLeftIcon size={16} /> Stands</Link>
      <PageHeader
        eyebrow="New stand"
        title="Create a stand"
        subtitle="Creates the owner account and the stand's radio channels (Dispatch, Drivers On Duty, Jobs, Maintenance, Emergency)."
      />

      {error && <div className="fp-pc-alert" role="alert">{error}</div>}

      <form className="fp-pc-card fp-pc-form" onSubmit={submit}>
        <fieldset>
          <legend>Stand</legend>
          <label>
            <span>Stand name</span>
            <input required minLength={2} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="SPTS" />
          </label>
          <label>
            <span>Booking address</span>
            <div className="fp-pc-suffix">
              <input
                required
                minLength={2}
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                value={form.subdomain}
                onChange={(e) => {
                  setSubTouched(true);
                  set('subdomain', e.target.value.toLowerCase());
                }}
                placeholder="spts"
              />
              <em>.farepro.app</em>
            </div>
          </label>
          <div className="fp-pc-form-row">
            <label>
              <span>Type</span>
              <select value={form.industry} onChange={(e) => set('industry', e.target.value)}>
                <option value="transportation">Kilo Taxi stand</option>
                <option value="general">Other fleet</option>
              </select>
            </label>
            <label>
              <span>Plan</span>
              <select value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                <option value="free">Free · 10 drivers</option>
                <option value="pro">Pro · 50 drivers</option>
                <option value="enterprise">Enterprise · 200 drivers</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Owner</legend>
          <label>
            <span>Owner name</span>
            <input required minLength={2} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
          </label>
          <div className="fp-pc-form-row">
            <label>
              <span>Owner phone</span>
              <input required type="tel" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="09…" />
            </label>
            <label>
              <span>Temporary password</span>
              <input required minLength={6} type="text" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            </label>
          </div>
          <p className="fp-pc-hint">The owner signs in at /org/signin with this phone and password.</p>
        </fieldset>

        <div className="fp-pc-form-actions">
          <Link to="/platform/stands" className="fp-pc-btn ghost">Cancel</Link>
          <button type="submit" className="fp-pc-btn" disabled={saving}>
            {saving ? 'Creating…' : 'Create stand'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlatformCreateStand;
