import React, { useState } from 'react';
import { PhoneIcon, VideoIcon, XIcon, BackspaceIcon } from '../icons/Icons';
import { useCall } from '../../contexts/CallContext';

interface DialPadProps {
  onClose: () => void;
  onCallStarted?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const DialPad: React.FC<DialPadProps> = ({ onClose, onCallStarted }) => {
  const { dialCall } = useCall();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const append = (key: string) => setPhone((p) => p + key);
  const backspace = () => setPhone((p) => p.slice(0, -1));

  const dial = async (callType: 'audio' | 'video') => {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      await dialCall(phone.trim(), callType);
      onCallStarted?.();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; status?: string } } };
      setError(e.response?.data?.error || 'Call failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialpad">
      <div className="dialpad-header">
        <h3>Dial Pad</h3>
        <button className="dialpad-close" onClick={onClose}>
          <XIcon size={18} />
        </button>
      </div>
      <input
        className="dialpad-display"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Enter phone number"
        readOnly={false}
      />
      <div className="dialpad-grid">
        {KEYS.map((key) => (
          <button key={key} className="dialpad-key" onClick={() => append(key)}>
            {key}
          </button>
        ))}
      </div>
      <div className="dialpad-actions">
        <button className="dialpad-backspace" onClick={backspace} disabled={!phone} aria-label="Backspace">
          <BackspaceIcon size={22} />
        </button>
        <button
          className="dialpad-call audio"
          onClick={() => dial('audio')}
          disabled={loading || !phone.trim()}
        >
          <PhoneIcon size={22} />
        </button>
        <button
          className="dialpad-call video"
          onClick={() => dial('video')}
          disabled={loading || !phone.trim()}
        >
          <VideoIcon size={22} />
        </button>
      </div>
      {error && <p className="dialpad-error">{error}</p>}
    </div>
  );
};

export default DialPad;
