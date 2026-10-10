import React, { useEffect, useState } from 'react';
import { useCall } from '../../contexts/CallContext';
import { PhoneIcon, XIcon, PhoneMissedIcon } from '../icons/Icons';

const BusyCallModal: React.FC = () => {
  const { busyInfo, clearCallError, initiateCall, activeCall } = useCall();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!busyInfo) return;
    setProgress(100);
    const start = Date.now();
    const duration = 5000;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [busyInfo]);

  if (!busyInfo) return null;

  const { name, user, isSelf } = busyInfo;
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarUrl;

  const handleCallBack = () => {
    clearCallError();
    if (activeCall?.conversationId) {
      initiateCall(activeCall.conversationId, activeCall.callType as 'audio' | 'video').catch(() => {});
    }
  };

  return (
    <div className="busy-modal-overlay" onClick={clearCallError}>
      <div className="busy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="busy-modal-progress">
          <div className="busy-modal-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <button className="busy-modal-close" onClick={clearCallError}>
          <XIcon size={16} />
        </button>

        {isSelf ? (
          /* You are already in a call */
          <div className="busy-modal-avatar busy-modal-avatar--self">
            <PhoneMissedIcon size={32} />
          </div>
        ) : (
          <div className="busy-modal-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : <span>{initial}</span>
            }
          </div>
        )}

        {isSelf ? (
          <>
            <h3 className="busy-modal-name">Can't place call</h3>
            <p className="busy-modal-status">You're already in an active call</p>
          </>
        ) : (
          <>
            <h3 className="busy-modal-name">{name}</h3>
            <p className="busy-modal-status">is busy on another call</p>
          </>
        )}

        <div className="busy-modal-actions">
          <button className="busy-modal-btn dismiss" onClick={clearCallError}>
            <XIcon size={18} />
            <span>Dismiss</span>
          </button>
          {!isSelf && activeCall?.conversationId && (
            <button className="busy-modal-btn callback" onClick={handleCallBack}>
              <PhoneIcon size={18} />
              <span>Call Back</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusyCallModal;
