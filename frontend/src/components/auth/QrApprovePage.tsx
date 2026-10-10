import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import { CheckIcon } from '../icons/Icons';
import { BrandMark } from '../brand/BrandMark';

const QrApprovePage: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('s') || '';
  const token = params.get('t') || '';
  const { user, token: authToken } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'approving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const isLoggedIn = !!(user && authToken);

  const handleApprove = async () => {
    if (!sessionId || !token) {
      setError('Invalid QR code link');
      setStatus('error');
      return;
    }
    setStatus('approving');
    setError('');
    try {
      await authAPI.approveQRSession({ sessionId, token });
      setStatus('done');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve login');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isLoggedIn && sessionId && token && status === 'idle') {
      handleApprove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, sessionId, token]);

  if (!sessionId || !token) {
    return (
      <div className="zello-auth-page">
        <div className="zello-auth-box" style={{ textAlign: 'center' }}>
          <BrandMark size={48} className="fp-brand-centered" />
          <h1>Invalid QR Link</h1>
          <p>This QR code link is invalid or expired.</p>
          <Link to="/login" className="zello-submit-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 20 }}>Back to Login</Link>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const returnUrl = encodeURIComponent(`/login/approve?s=${sessionId}&t=${token}`);
    return (
      <div className="zello-auth-page">
        <div className="zello-auth-box" style={{ textAlign: 'center' }}>
          <BrandMark size={48} className="fp-brand-centered" />
          <h1>Confirm Desktop Login</h1>
          <p>Sign in on this device first, then approve the desktop session.</p>
          <Link to={`/login?return=${returnUrl}`} className="zello-submit-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 20 }}>
            Sign in to approve
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="zello-auth-page">
      <div className="zello-auth-box" style={{ textAlign: 'center' }}>
        {status === 'approving' && (
          <>
            <div className="app-loading-spinner" style={{ margin: '0 auto 20px' }} />
            <h1>Approving desktop login...</h1>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="zello-approve-success" style={{ margin: '0 auto 20px' }}>
              <CheckIcon size={40} />
            </div>
            <h1>Desktop linked</h1>
            <p>You can close this page and return to TeamLink on your computer.</p>
            <button type="button" className="zello-submit-btn" style={{ marginTop: 20 }} onClick={() => navigate('/')}>
              Open app
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="zello-alert error" style={{ marginBottom: 20, textAlign: 'left' }}>{error}</div>
            <button type="button" className="zello-submit-btn" onClick={handleApprove}>
              Try again
            </button>
          </>
        )}
        {status === 'idle' && (
          <>
            <h1>Approve desktop login?</h1>
            <p>Allow this computer to access your account?</p>
            <button type="button" className="zello-submit-btn" style={{ marginTop: 20 }} onClick={handleApprove}>
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default QrApprovePage;
