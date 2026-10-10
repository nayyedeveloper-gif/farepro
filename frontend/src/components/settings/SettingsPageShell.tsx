import React from 'react';
import { ChevronLeftIcon } from '../icons/Icons';

interface SettingsPageShellProps {
  title: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

const SettingsPageShell: React.FC<SettingsPageShellProps> = ({
  title,
  onBack,
  rightAction,
  children,
}) => (
  <div className="tg-set-page">
    <header className="tg-set-page-header">
      <button type="button" className="tg-set-back" onClick={onBack} aria-label="Back">
        <ChevronLeftIcon size={22} />
      </button>
      <h1 className="tg-set-page-title">{title}</h1>
      <div className="tg-set-page-action">{rightAction}</div>
    </header>
    <div className="tg-set-page-body">{children}</div>
  </div>
);

export default SettingsPageShell;
