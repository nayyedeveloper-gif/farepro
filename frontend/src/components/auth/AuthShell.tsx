import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon } from '../icons/Icons';

interface AuthShellProps {
  children: React.ReactNode;
  /** Where the back control goes. Omit to hide back (e.g. primary login). */
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  wide?: boolean;
  brandHref?: string;
}

/**
 * Shared auth chrome: brand, optional back, centered panel.
 * Back only when navigation actually needs it — no decorative arrows.
 */
const AuthShell: React.FC<AuthShellProps> = ({
  children,
  backTo,
  backLabel = 'Back',
  onBack,
  wide = false,
  brandHref = '/',
}) => {
  const showBack = Boolean(backTo || onBack);

  return (
    <div className="kl-auth">
      <header className="kl-auth-top">
        {showBack ? (
          onBack ? (
            <button type="button" className="kl-auth-back" onClick={onBack} aria-label={backLabel}>
              <ChevronLeftIcon size={20} />
              <span>{backLabel}</span>
            </button>
          ) : (
            <Link to={backTo!} className="kl-auth-back" aria-label={backLabel}>
              <ChevronLeftIcon size={20} />
              <span>{backLabel}</span>
            </Link>
          )
        ) : (
          <span className="kl-auth-back-spacer" aria-hidden="true" />
        )}

        <Link to={brandHref} className="kl-auth-brand" aria-label="FarePro home">
          <span className="kl-auth-mark">FP</span>
          <span>FarePro</span>
        </Link>

        <span className="kl-auth-back-spacer" aria-hidden="true" />
      </header>

      <main className={`kl-auth-panel${wide ? ' is-wide' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default AuthShell;
