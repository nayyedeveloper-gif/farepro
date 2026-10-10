import React, { useEffect, useRef, useState } from 'react';
import { SHARE_SURFACES } from '../../services/screenShare';
import type { ScreenShareRequest, ShareOptimization, ShareSurface } from '../../services/screenShare';
import { AppWindowIcon, BrowserTabIcon, MonitorIcon, XIcon } from '../icons/Icons';

const SURFACE_ICON: Record<ShareSurface, React.FC<{ size?: number }>> = {
  monitor: MonitorIcon,
  window: AppWindowIcon,
  browser: BrowserTabIcon,
};

const PREF_KEY = 'screenSharePrefs';

function loadPrefs(): ScreenShareRequest {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as Partial<ScreenShareRequest>;
    return {
      surface: saved.surface && saved.surface in SURFACE_ICON ? saved.surface : 'monitor',
      audio: saved.audio ?? false,
      optimizeFor: saved.optimizeFor === 'motion' ? 'motion' : 'detail',
    };
  } catch {
    return { surface: 'monitor', audio: false, optimizeFor: 'detail' };
  }
}

interface Props {
  isSharing: boolean;
  onShare: (req: ScreenShareRequest) => void;
  onStop: () => void;
  onClose: () => void;
}

const ScreenShareMenu: React.FC<Props> = ({ isSharing, onShare, onStop, onClose }) => {
  const [prefs, setPrefs] = useState<ScreenShareRequest>(loadPrefs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const update = (patch: Partial<ScreenShareRequest>) => setPrefs(p => ({ ...p, ...patch }));

  const share = () => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    onShare(prefs);
  };

  const setOptimize = (v: ShareOptimization) => update({ optimizeFor: v });

  return (
    <div className="ss-menu" ref={ref} role="dialog" aria-label="Share your screen">
      <div className="ss-menu-head">
        <strong>{isSharing ? 'Change what you share' : 'Share your screen'}</strong>
        <button type="button" className="ss-icon-btn" onClick={onClose} aria-label="Close">
          <XIcon size={16} />
        </button>
      </div>

      <div className="ss-surfaces" role="radiogroup" aria-label="What to share">
        {SHARE_SURFACES.map(s => {
          const Icon = SURFACE_ICON[s.id];
          const selected = prefs.surface === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`ss-surface ${selected ? 'selected' : ''}`}
              onClick={() => update({ surface: s.id })}
            >
              <Icon size={22} />
              <span className="ss-surface-label">{s.label}</span>
              <span className="ss-surface-hint">{s.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="ss-row">
        <span className="ss-row-label">Optimize for</span>
        <div className="ss-segment" role="radiogroup" aria-label="Optimize for">
          <button
            type="button"
            role="radio"
            aria-checked={prefs.optimizeFor === 'detail'}
            className={prefs.optimizeFor === 'detail' ? 'active' : ''}
            onClick={() => setOptimize('detail')}
          >
            Text &amp; docs
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={prefs.optimizeFor === 'motion'}
            className={prefs.optimizeFor === 'motion' ? 'active' : ''}
            onClick={() => setOptimize('motion')}
          >
            Video
          </button>
        </div>
      </div>

      <label className="ss-row ss-toggle">
        <span>
          <span className="ss-row-label">Share sound</span>
          <span className="ss-row-hint">Tab sound in Chrome/Edge; full system sound on Windows</span>
        </span>
        <input
          type="checkbox"
          checked={prefs.audio}
          onChange={e => update({ audio: e.target.checked })}
        />
      </label>

      <div className="ss-actions">
        {isSharing && (
          <button type="button" className="ss-btn ss-btn-danger" onClick={onStop}>
            Stop sharing
          </button>
        )}
        <button type="button" className="ss-btn ss-btn-primary" onClick={share}>
          {isSharing ? 'Share something else' : 'Choose and share'}
        </button>
      </div>
      <p className="ss-foot">Your browser will ask you to confirm what to share.</p>
    </div>
  );
};

export default ScreenShareMenu;
