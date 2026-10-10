import React from 'react';
import Navbar from './Navbar';
import { Link } from 'react-router-dom';
import { CheckIcon, ChevronRightIcon } from '../icons/Icons';

const FEATURES = [
  'Dedicated account manager',
  'SSO & SAML integration',
  'Custom subdomain & branding',
  'Priority 24/7 support',
  'Advanced analytics & reporting',
  'Unlimited team members',
  'API access & webhooks',
  'Compliance & audit logs',
];

const Enterprise: React.FC = () => {
  return (
    <div className="tl-landing">
      <Navbar />
      <section className="tl-page-header">
        <div className="tl-page-inner">
          <h1>Enterprise</h1>
          <p>Built for large-scale fleet operations that need security, control, and support.</p>
        </div>
      </section>
      <section className="tl-page-body">
        <div className="tl-page-inner">
          <div className="tl-enterprise-grid">
            <div className="tl-enterprise-features">
              <h2>Everything included</h2>
              <ul>
                {FEATURES.map((f) => (
                  <li key={f}>
                    <CheckIcon size={18} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="tl-enterprise-cta">
              <h2>Talk to our team</h2>
              <p>Get a customized plan tailored to your organization's needs.</p>
              <Link to="/contact" className="tl-hero-cta">Contact Sale <ChevronRightIcon size={18} /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Enterprise;
