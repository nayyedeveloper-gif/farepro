import React, { useState } from 'react';
import { useSound } from '../../contexts/SoundContext';
import { PlayIcon, PhoneIcon } from '../icons/Icons';
import type { RingtoneId, NotificationSoundId } from '../../services/SoundService';

const RINGTONES: { id: RingtoneId; label: string; desc: string }[] = [
  { id: 'telegram', label: 'TeamLink', desc: 'Classic TeamLink ascending arpeggio' },
  { id: 'classic', label: 'Classic', desc: 'Simple double-beep ringtone' },
  { id: 'minimal', label: 'Minimal', desc: 'Soft single pulse' },
  { id: 'pulse', label: 'Pulse', desc: 'Rhythmic four-tone pulse' },
];

const NOTIF_SOUNDS: { id: NotificationSoundId; label: string; desc: string }[] = [
  { id: 'message', label: 'Message', desc: 'TeamLink signature two-tone chime' },
  { id: 'pop', label: 'Pop', desc: 'Soft click pop' },
  { id: 'chime', label: 'Chime', desc: 'Three-note ascending chime' },
  { id: 'bell', label: 'Bell', desc: 'Warm mellow bell' },
];

const SoundSettings: React.FC = () => {
  const { getSettings, updateSettings, previewRingtone, previewNotificationSound } = useSound();
  const [settings, setSettings] = useState(getSettings);

  const update = <K extends keyof ReturnType<typeof getSettings>>(
    key: K,
    value: ReturnType<typeof getSettings>[K],
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    updateSettings({ [key]: value });
  };

  return (
    <div className="sound-settings">
      {/* Notification Sound */}
      <div className="sound-block">
        <div className="sound-block-header">
          <h4 className="sound-block-title">Notification Sound</h4>
          <div className="volume-control">
            <PhoneIcon size={16} className="volume-icon" />
            <input
              type="range"
              id="notif-volume"
              name="notifVolume"
              min={0}
              max={1}
              step={0.05}
              value={settings.notifVolume}
              onChange={(e) => update('notifVolume', parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
        <div className="sound-options">
          {NOTIF_SOUNDS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sound-option ${settings.notificationSoundId === s.id ? 'active' : ''}`}
              onClick={() => {
                update('notificationSoundId', s.id);
                previewNotificationSound(s.id, settings.notifVolume);
              }}
            >
              <div className="sound-option-content">
                <span className="sound-option-name">{s.label}</span>
                <span className="sound-option-desc">{s.desc}</span>
              </div>
              <button
                type="button"
                className="sound-preview-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  previewNotificationSound(s.id, settings.notifVolume);
                }}
                title="Preview"
              >
                <PlayIcon size={20} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Ringtone */}
      <div className="sound-block">
        <div className="sound-block-header">
          <h4 className="sound-block-title">Ringtone (Calls)</h4>
          <div className="volume-control">
            <PhoneIcon size={16} className="volume-icon" />
            <input
              type="range"
              id="ring-volume"
              name="ringVolume"
              min={0}
              max={1}
              step={0.05}
              value={settings.ringVolume}
              onChange={(e) => update('ringVolume', parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
        <div className="sound-options">
          {RINGTONES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sound-option ${settings.ringtoneId === r.id ? 'active' : ''}`}
              onClick={() => {
                update('ringtoneId', r.id);
                previewRingtone(r.id, settings.ringVolume);
              }}
            >
              <div className="sound-option-content">
                <span className="sound-option-name">{r.label}</span>
                <span className="sound-option-desc">{r.desc}</span>
              </div>
              <button
                type="button"
                className="sound-preview-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  previewRingtone(r.id, settings.ringVolume);
                }}
                title="Preview"
              >
                <PlayIcon size={14} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Message Sent Sound */}
      <div className="sound-toggle-section">
        <div className="sound-toggle-content">
          <span className="sound-toggle-label">Message sent sound</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="message-sent-sound"
              name="messageSentEnabled"
              checked={settings.messageSentEnabled}
              onChange={(e) => update('messageSentEnabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default SoundSettings;
