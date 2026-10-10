import React, { useEffect, useState } from 'react';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import SettingsToggle from '../SettingsToggle';

interface PTTAudioPageProps {
  onBack: () => void;
}

const PTTAudioPage: React.FC<PTTAudioPageProps> = ({ onBack }) => {
  const [micSensitivity, setMicSensitivity] = useState(() =>
    parseInt(localStorage.getItem('ptt_micSensitivity') || '70', 10)
  );
  const [speakerVolume, setSpeakerVolume] = useState(() =>
    parseInt(localStorage.getItem('ptt_speakerVolume') || '80', 10)
  );
  const [releaseDelay, setReleaseDelay] = useState(() =>
    parseInt(localStorage.getItem('ptt_releaseDelay') || '300', 10)
  );
  const [noiseSuppression, setNoiseSuppression] = useState(() =>
    localStorage.getItem('ptt_noiseSuppression') !== 'false'
  );
  const [echoCancellation, setEchoCancellation] = useState(() =>
    localStorage.getItem('ptt_echoCancellation') !== 'false'
  );
  const [autoGain, setAutoGain] = useState(() =>
    localStorage.getItem('ptt_autoGain') !== 'false'
  );

  useEffect(() => { localStorage.setItem('ptt_micSensitivity', String(micSensitivity)); }, [micSensitivity]);
  useEffect(() => { localStorage.setItem('ptt_speakerVolume', String(speakerVolume)); }, [speakerVolume]);
  useEffect(() => { localStorage.setItem('ptt_releaseDelay', String(releaseDelay)); }, [releaseDelay]);
  useEffect(() => { localStorage.setItem('ptt_noiseSuppression', String(noiseSuppression)); }, [noiseSuppression]);
  useEffect(() => { localStorage.setItem('ptt_echoCancellation', String(echoCancellation)); }, [echoCancellation]);
  useEffect(() => { localStorage.setItem('ptt_autoGain', String(autoGain)); }, [autoGain]);

  return (
    <SettingsPageShell title="PTT &amp; Audio" onBack={onBack}>
      <SettingsGroup label="Microphone">
        <div className="tg-set-range-block">
          <div className="tg-set-range-header">
            <span>Microphone Sensitivity</span>
            <span className="tg-set-range-value">{micSensitivity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={micSensitivity}
            onChange={(e) => setMicSensitivity(parseInt(e.target.value, 10))}
            className="settings-range"
          />
          <div className="settings-range-labels">
            <span>Low</span><span>Medium</span><span>High</span>
          </div>
        </div>
        <div className="tg-set-divider" />
        <SettingsToggle
          label="Noise Suppression"
          hint="Reduce background noise during transmission"
          checked={noiseSuppression}
          onChange={setNoiseSuppression}
        />
        <div className="tg-set-divider" />
        <SettingsToggle
          label="Echo Cancellation"
          hint="Prevent echo feedback on speaker"
          checked={echoCancellation}
          onChange={setEchoCancellation}
        />
        <div className="tg-set-divider" />
        <SettingsToggle
          label="Auto Gain Control"
          hint="Automatically adjust microphone gain"
          checked={autoGain}
          onChange={setAutoGain}
        />
      </SettingsGroup>

      <SettingsGroup label="Speaker">
        <div className="tg-set-range-block">
          <div className="tg-set-range-header">
            <span>Speaker Volume</span>
            <span className="tg-set-range-value">{speakerVolume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={speakerVolume}
            onChange={(e) => setSpeakerVolume(parseInt(e.target.value, 10))}
            className="settings-range"
          />
          <div className="settings-range-labels">
            <span>Mute</span><span>Medium</span><span>Max</span>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup label="PTT Behavior" footer="Release delay prevents accidental cut-offs at end of speech.">
        <div className="tg-set-range-block">
          <div className="tg-set-range-header">
            <span>Release Delay</span>
            <span className="tg-set-range-value">{releaseDelay}ms</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={100}
            value={releaseDelay}
            onChange={(e) => setReleaseDelay(parseInt(e.target.value, 10))}
            className="settings-range"
          />
          <div className="settings-range-labels">
            <span>Instant</span><span>0.5s</span><span>1s</span>
          </div>
        </div>
      </SettingsGroup>
    </SettingsPageShell>
  );
};

export default PTTAudioPage;
