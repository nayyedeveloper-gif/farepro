import './brand.css';

interface BrandMarkProps {
  size?: number;
  withName?: boolean;
  className?: string;
}

export function BrandMark({ size = 32, withName = false, className = '' }: BrandMarkProps) {
  return (
    <span className={`fp-brand ${className}`.trim()}>
      <span
        className="fp-brand-mark"
        aria-hidden={withName || undefined}
        aria-label={withName ? undefined : 'FarePro'}
        role={withName ? undefined : 'img'}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36), borderRadius: Math.round(size * 0.28) }}
      >
        FP
      </span>
      {withName && <span className="fp-brand-name">FarePro</span>}
    </span>
  );
}
