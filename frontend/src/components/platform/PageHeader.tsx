import React from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, subtitle, actions }) => (
  <header className="fp-pc-head">
    <div>
      {eyebrow && <p className="fp-pc-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {subtitle && <p className="fp-pc-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="fp-pc-head-actions">{actions}</div>}
  </header>
);

export default PageHeader;
