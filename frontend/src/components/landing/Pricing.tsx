import React from 'react';
import Navbar from './Navbar';
import { Link } from 'react-router-dom';
import { CheckIcon, ChevronRightIcon } from '../icons/Icons';

const PLANS = [
  {
    name: 'Individual',
    price: 'Free',
    desc: 'For solo drivers and small teams getting started.',
    features: [
      'Up to 10 drivers',
      '5 channels',
      'Push-to-talk voice',
      'Basic fleet map',
      'Mobile + desktop apps',
    ],
    cta: 'Try for free',
    link: '/register',
    highlight: false,
  },
  {
    name: 'Team',
    price: '$9',
    period: '/driver/mo',
    desc: 'For growing fleets that need more control.',
    features: [
      'Unlimited drivers',
      'Unlimited channels',
      'Route history & playback',
      'Role-based access',
      'Priority support',
    ],
    cta: 'Start free trial',
    link: '/register',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'For large-scale operations with advanced needs.',
    features: [
      'Everything in Team',
      'SSO & SAML',
      'Custom branding',
      'Advanced analytics',
      'Dedicated account manager',
    ],
    cta: 'Contact Sale',
    link: '/contact',
    highlight: false,
  },
];

const Pricing: React.FC = () => {
  return (
    <div className="tl-landing">
      <Navbar />
      <section className="tl-page-header">
        <div className="tl-page-inner">
          <h1>Pricing</h1>
          <p>Simple, transparent pricing for teams of any size.</p>
        </div>
      </section>
      <section className="tl-page-body">
        <div className="tl-page-inner">
          <div className="tl-pricing-grid">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`tl-pricing-card ${plan.highlight ? 'highlight' : ''}`}>
                {plan.highlight && <span className="tl-pricing-badge">Most popular</span>}
                <h3>{plan.name}</h3>
                <div className="tl-pricing-price">
                  <span className="tl-pricing-amount">{plan.price}</span>
                  {plan.period && <span className="tl-pricing-period">{plan.period}</span>}
                </div>
                <p className="tl-pricing-desc">{plan.desc}</p>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <CheckIcon size={16} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to={plan.link} className={plan.highlight ? 'tl-hero-cta' : 'tl-pricing-btn'}>
                  {plan.cta} <ChevronRightIcon size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
