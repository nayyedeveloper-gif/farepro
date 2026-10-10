import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { BrandMark } from '../brand/BrandMark';

const POLL_MS = 2000;

const QrLoginPanel: React.FC = () => {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const createSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.createQRSession();
      const { sessionId: sid, token: tok, expiresAt: exp } = res.data;
      setSessionId(sid);
      setExpiresAt(new Date(exp));
      const origin = window.location.origin;
      setQrUrl(`${origin}/login/approve?s=${sid}&t=${tok}`);
    } catch {
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createSession();
  }, [createSession]);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await authAPI.getQRStatus(sessionId);
        if (res.data.status === 'approved' && res.data.token && res.data.user) {
          setAuth(res.data.token, res.data.user);
          navigate('/');
        }
        if (res.data.status === 'expired') {
          setError('QR code expired. Generating a new one...');
          createSession();
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    const id = window.setInterval(poll, POLL_MS);
    poll();
    return () => window.clearInterval(id);
  }, [sessionId, setAuth, navigate, createSession]);

  const secondsLeft = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className="zello-qr-panel">
      <div className="zello-qr-frame">
        {loading ? (
          <div className="zello-qr-loading">
            <div className="app-loading-spinner" />
          </div>
        ) : qrUrl ? (
          <>
            <QRCodeSVG value={qrUrl} size={200} level="M" includeMargin={false} />
            <div className="zello-qr-logo">
              <BrandMark size={36} />
            </div>
          </>
        ) : null}
      </div>

      <div className="zello-qr-steps">
        <div className="zello-qr-step">
          <span className="zello-qr-step-num">1</span>
          <span>Open TeamLink on your phone</span>
        </div>
        <div className="zello-qr-step">
          <span className="zello-qr-step-num">2</span>
          <span>Go to <strong>Settings → Devices → Link Desktop</strong></span>
        </div>
        <div className="zello-qr-step">
          <span className="zello-qr-step-num">3</span>
          <span>Point your phone at this screen</span>
        </div>
      </div>

      {error && <div className="zello-alert error">{error}</div>}

      {!loading && secondsLeft > 0 && (
        <p className="zello-qr-expiry">Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</p>
      )}

      <button type="button" className="zello-text-btn" onClick={createSession} disabled={loading}>
        Refresh QR Code
      </button>
    </div>
  );
};

export default QrLoginPanel;
