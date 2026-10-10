import React, { useEffect } from 'react';
import { useCall } from '../../contexts/CallContext';
import { PhoneIcon, VideoIcon, PhoneHangupIcon } from '../icons/Icons';
import type { Call } from '../../types';

interface IncomingCallModalProps {
  call: Call;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ call }) => {
  const { acceptCall, rejectCall, callerInfo } = useCall();

  useEffect(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2VjH9nZ3B0e4aNk5aQh3pqaWxwe4aNk5aQh3pqaWxwe4aNk5aQh3pqaWxwe4aNk5aQh3pq');
    audio.loop = true;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, []);

  const name = callerInfo?.firstName || callerInfo?.username || 'Unknown';
  const isVideo = call.callType === 'video';

  return (
    <div className="call-modal-overlay incoming">
      <div className="call-modal-content incoming-call">
        <div className="incoming-call-bg" />
        <div className="call-avatar incoming-avatar">
          {callerInfo?.avatarUrl ? (
            <img src={callerInfo.avatarUrl} alt="" />
          ) : isVideo ? (
            <VideoIcon size={48} />
          ) : (
            <PhoneIcon size={48} />
          )}
        </div>
        <h2 className="call-title">{name}</h2>
        <p className="call-status">
          {isVideo ? 'Incoming video call' : 'Incoming voice call'}
        </p>
        <p className="call-substatus">TeamLink</p>
        <div className="call-actions incoming-actions">
          <button className="call-btn reject" onClick={() => rejectCall(call.id)}>
            <PhoneHangupIcon size={28} />
            <span>Decline</span>
          </button>
          <button className="call-btn accept" onClick={() => acceptCall(call.id)}>
            {isVideo ? <VideoIcon size={28} /> : <PhoneIcon size={28} />}
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
