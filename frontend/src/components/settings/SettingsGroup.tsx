import React from 'react';

interface SettingsGroupProps {
  label?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({ label, children, footer }) => (
  <div className="tg-set-group">
    {label && <div className="tg-set-group-label">{label}</div>}
    <div className="tg-set-group-card">{children}</div>
    {footer && <p className="tg-set-group-footer">{footer}</p>}
  </div>
);

export default SettingsGroup;
