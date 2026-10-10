import React from 'react';

interface SettingsToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ label, hint, checked, onChange }) => (
  <div className="tg-set-row tg-set-toggle-row">
    <span className="tg-set-row-body">
      <span className="tg-set-row-label">{label}</span>
      {hint && <span className="tg-set-row-hint">{hint}</span>}
    </span>
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="settings-toggle-track" />
    </label>
  </div>
);

export default SettingsToggle;
