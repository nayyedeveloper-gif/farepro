import React from 'react';
import Navbar from './Navbar';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../icons/Icons';

const RESOURCES = [
  { title: 'Getting Started Guide', desc: 'Learn how to set up your team and invite members in minutes.', link: '/register' },
  { title: 'Fleet Management Best Practices', desc: 'Tips for organizing channels, roles, and dispatch workflows.', link: '/register' },
  { title: 'API Documentation', desc: 'Integrate TeamLink with your existing systems via REST API.', link: '/register' },
  { title: 'Driver Safety Toolkit', desc: 'Resources for implementing safe communication practices on the road.', link: '/register' },
  { title: 'Case Studies', desc: 'See how teams across industries use TeamLink to stay connected.', link: '/register' },
  { title: 'Help Center', desc: 'Find answers to common questions and troubleshooting guides.', link: '/register' },
];

const Resources: React.FC = () => {
  return (
    <div className="tl-landing">
      <Navbar />
      <section className="tl-page-header">
        <div className="tl-page-inner">
          <h1>Resources</h1>
          <p>Guides, documentation, and tools to help you get the most out of TeamLink.</p>
        </div>
      </section>
      <section className="tl-page-body">
        <div className="tl-page-inner">
          <div className="tl-resources-grid">
            {RESOURCES.map((item) => (
              <Link key={item.title} to={item.link} className="tl-resource-card">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <span className="tl-resource-link">Read more <ChevronRightIcon size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Resources;
