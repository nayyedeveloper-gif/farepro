import React, { useEffect, useState } from 'react';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';

interface AppearancePageProps {
  onBack: () => void;
}

const BUBBLE_COLORS = ['#2b5278', '#1a7a4c', '#6b3fa0', '#8b3a2f', '#2a6b8a'];

const AppearancePage: React.FC<AppearancePageProps> = ({ onBack }) => {
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('app_fontSize') || '15', 10));
  const [bubbleColor, setBubbleColor] = useState(() => localStorage.getItem('app_bubbleColor') || '#2b5278');

  useEffect(() => {
    localStorage.setItem('app_fontSize', String(fontSize));
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('app_bubbleColor', bubbleColor);
    document.documentElement.style.setProperty('--bubble-own-bg', bubbleColor);
  }, [bubbleColor]);

  return (
    <SettingsPageShell title="Appearance" onBack={onBack}>
      <SettingsGroup label="Text Size">
        <div className="tg-set-range-block">
          <div className="tg-set-range-header">
            <span>Font Size</span>
            <span className="tg-set-range-value">{fontSize}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="settings-range"
          />
          <div className="settings-range-labels">
            <span>Small</span><span>Default</span><span>Large</span>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup label="Chat Bubble Color" footer={
        <>Preview: <span className="settings-bubble-preview" style={{ background: bubbleColor }}>Hello!</span></>
      }>
        <div className="tg-set-color-picker">
          {BUBBLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`settings-color-swatch ${bubbleColor === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setBubbleColor(c)}
            />
          ))}
          <input
            type="color"
            value={bubbleColor}
            onChange={(e) => setBubbleColor(e.target.value)}
            className="settings-color-custom"
            title="Custom color"
          />
        </div>
      </SettingsGroup>
    </SettingsPageShell>
  );
};

export default AppearancePage;
