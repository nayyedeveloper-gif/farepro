import React from 'react';
import { ChevronRightIcon } from '../icons/Icons';

interface SettingsRowProps {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
  showArrow?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  hint,
  onClick,
  danger,
  trailing,
  showArrow = !!onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`tg-set-row${danger ? ' danger' : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="tg-set-row-icon">{icon}</span>}
      <span className="tg-set-row-body">
        <span className="tg-set-row-label">{label}</span>
        {hint && <span className="tg-set-row-hint">{hint}</span>}
      </span>
      {value && <span className="tg-set-row-value">{value}</span>}
      {trailing}
      {showArrow && onClick && <ChevronRightIcon size={16} className="tg-set-row-arrow" />}
    </Tag>
  );
};

export default SettingsRow;
