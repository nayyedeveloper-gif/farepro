import React, { useState } from 'react';
import { useCall } from '../../contexts/CallContext';
import { PhoneIcon, VideoIcon } from '../icons/Icons';

interface CallButtonProps {
  conversationId: string;
  callType: 'audio' | 'video';
}

const CallButton: React.FC<CallButtonProps> = ({ conversationId, callType }) => {
  const { initiateCall, isCallActive } = useCall();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (isCallActive) return;
    setLoading(true);
    try {
      await initiateCall(conversationId, callType);
    } catch (error: unknown) {
      console.error('Failed to initiate call:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="chat-header-btn"
      onClick={handleClick}
      disabled={loading || isCallActive}
      title={callType === 'video' ? 'Video call' : 'Voice call'}
    >
      {callType === 'video' ? <VideoIcon size={20} /> : <PhoneIcon size={20} />}
    </button>
  );
};

export default CallButton;
