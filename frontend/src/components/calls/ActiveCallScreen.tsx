import React, { useEffect, useRef, useState } from 'react';
import { ConnectionState } from 'livekit-client';
import { useCall } from '../../contexts/CallContext';
import {
  MicIcon,
  MicOffIcon,
  CameraIcon,
  CameraOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  PhoneHangupIcon,
  ScreenShareIcon,
  ScreenShareOffIcon,
  MaximizeIcon,
  XIcon,
  AlertIcon,
} from '../icons/Icons';
import ScreenShareMenu from './ScreenShareMenu';
import type { Call } from '../../types';
import type { ShareSurface } from '../../services/screenShare';

interface ActiveCallScreenProps {
  call: Call;
}

const SURFACE_PHRASE: Record<ShareSurface, string> = {
  monitor: 'your entire screen',
  window: 'a window',
  browser: 'a browser tab',
};

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({ call }) => {
  const {
    room,
    endCall,
    callerInfo,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRemoteScreenSharing,
    isRemoteCameraOn,
    screenShareSupported,
    sharedSurface,
    screenShareError,
    clearScreenShareError,
    connectionState,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    attachLocalVideo,
    attachLocalScreen,
    attachRemoteVideo,
    attachRemoteScreenShare,
  } = useCall();

  const stageRef = useRef<HTMLDivElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const connected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!room) return;
    room.remoteParticipants.forEach(p => p.setVolume(speakerOn ? 1 : 0));
  }, [room, speakerOn, connectionState]);

  useEffect(() => {
    if (!screenShareError) return;
    const t = setTimeout(clearScreenShareError, 12000);
    return () => clearTimeout(t);
  }, [screenShareError, clearScreenShareError]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const displayName = [callerInfo?.firstName, callerInfo?.lastName].filter(Boolean).join(' ')
    || callerInfo?.username
    || 'Call';
  const initial = displayName.charAt(0).toUpperCase();
  const isVideo = call.callType === 'video';
  const showCamera = isVideo && !isVideoOff;

  const statusText = connected
    ? formatDuration(callDuration)
    : connectionState === ConnectionState.Connecting
      ? 'Connecting…'
      : 'Reconnecting…';

  const avatar = (cls: string) => (
    <div className={cls}>
      {callerInfo?.avatarUrl ? <img src={callerInfo.avatarUrl} alt="" /> : <span>{initial}</span>}
    </div>
  );

  const selfTile = showCamera && (
    <div className="call-tile">
      <video ref={attachLocalVideo} autoPlay playsInline muted className="call-tile-video mirror" />
      <span className="call-tile-label">You</span>
    </div>
  );

  const remoteTile = (
    <div className="call-tile">
      {isRemoteCameraOn
        ? <video ref={attachRemoteVideo} autoPlay playsInline className="call-tile-video" />
        : avatar('call-tile-avatar')}
      <span className="call-tile-label">{displayName}</span>
    </div>
  );

  let stage: React.ReactNode;
  if (isRemoteScreenSharing) {
    stage = (
      <div className="call-present">
        <div className="call-present-stage" ref={stageRef}>
          <video
            ref={attachRemoteScreenShare}
            autoPlay
            playsInline
            className="call-present-video"
            style={{ objectFit: fitMode }}
          />
          <div className="call-present-bar">
            <span className="call-present-chip">
              <ScreenShareIcon size={14} />
              {displayName} is presenting
            </span>
            <div className="call-present-tools">
              <button
                type="button"
                onClick={() => setFitMode(m => (m === 'contain' ? 'cover' : 'contain'))}
                title={fitMode === 'contain' ? 'Fill the stage' : 'Show the whole screen'}
              >
                {fitMode === 'contain' ? 'Fill' : 'Fit'}
              </button>
              <button type="button" onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
                <MaximizeIcon size={16} />
              </button>
            </div>
          </div>
        </div>
        <aside className="call-filmstrip">
          {remoteTile}
          {selfTile}
        </aside>
      </div>
    );
  } else if (isScreenSharing) {
    stage = (
      <div className="call-present">
        <div className="call-self-share">
          <div className="call-self-share-preview">
            <video ref={attachLocalScreen} autoPlay playsInline muted className="call-present-video" />
          </div>
          <div className="call-self-share-text">
            <h3>You're sharing {sharedSurface ? SURFACE_PHRASE[sharedSurface] : 'your screen'}</h3>
            <p>
              {displayName} can see it now.
              {sharedSurface === 'monitor' && ' Switch to another window to avoid a mirror effect.'}
            </p>
            <button type="button" className="ss-btn ss-btn-danger" onClick={stopScreenShare}>
              Stop sharing
            </button>
          </div>
        </div>
        <aside className="call-filmstrip">
          {remoteTile}
          {selfTile}
        </aside>
      </div>
    );
  } else if (isVideo) {
    stage = (
      <div className="video-call-container">
        {isRemoteCameraOn ? (
          <video ref={attachRemoteVideo} className="remote-video" autoPlay playsInline />
        ) : (
          <div className="video-call-placeholder">{avatar('call-avatar-large')}</div>
        )}
        {showCamera && (
          <video ref={attachLocalVideo} className="local-video mirror" autoPlay playsInline muted />
        )}
      </div>
    );
  } else {
    stage = (
      <div className="voice-call-container">
        {avatar('voice-call-avatar')}
        <p className="call-encryption">Encrypted connection</p>
      </div>
    );
  }

  return (
    <div className={`active-call-screen ${isVideo ? 'video-mode' : 'voice-mode'} ${isRemoteScreenSharing || isScreenSharing ? 'presenting' : ''}`}>
      <header className="call-topbar">
        <div className="call-topbar-title">
          <h2>{displayName}</h2>
          <p className={`call-duration${connected ? '' : ' call-status-warn'}`}>{statusText}</p>
        </div>
        {isScreenSharing && isRemoteScreenSharing && (
          <span className="call-sharing-pill">
            You're also sharing
            <button type="button" onClick={stopScreenShare}>Stop</button>
          </span>
        )}
      </header>

      {screenShareError && (
        <div className="call-toast" role="alert">
          <AlertIcon size={18} />
          <span>{screenShareError}</span>
          <button type="button" onClick={clearScreenShareError} aria-label="Dismiss">
            <XIcon size={16} />
          </button>
        </div>
      )}

      <main className="call-stage">{stage}</main>

      <div className="call-controls-bar">
        <div className="call-controls">
          <button
            className={`control-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
          >
            {isMuted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {isVideo && (
            <button
              className={`control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              aria-pressed={isVideoOff}
            >
              {isVideoOff ? <CameraOffIcon size={22} /> : <CameraIcon size={22} />}
              <span>Camera</span>
            </button>
          )}

          <div className="control-anchor">
            <button
              className={`control-btn ${isScreenSharing ? 'sharing' : ''}`}
              onClick={() => setShareMenuOpen(o => !o)}
              disabled={!screenShareSupported || !connected}
              title={
                !screenShareSupported
                  ? 'Screen sharing needs a desktop browser'
                  : isScreenSharing ? 'Sharing options' : 'Share your screen'
              }
              aria-haspopup="dialog"
              aria-expanded={shareMenuOpen}
            >
              {isScreenSharing ? <ScreenShareOffIcon size={22} /> : <ScreenShareIcon size={22} />}
              <span>{isScreenSharing ? 'Sharing' : 'Share'}</span>
            </button>
            {shareMenuOpen && (
              <ScreenShareMenu
                isSharing={isScreenSharing}
                onClose={() => setShareMenuOpen(false)}
                onShare={req => { setShareMenuOpen(false); startScreenShare(req); }}
                onStop={() => { setShareMenuOpen(false); stopScreenShare(); }}
              />
            )}
          </div>

          <button
            className={`control-btn ${speakerOn ? '' : 'active'}`}
            onClick={() => setSpeakerOn(on => !on)}
            title={speakerOn ? 'Mute incoming sound' : 'Unmute incoming sound'}
            aria-pressed={!speakerOn}
          >
            {speakerOn ? <SpeakerIcon size={22} /> : <SpeakerOffIcon size={22} />}
            <span>Sound</span>
          </button>

          <button
            className="control-btn end-call"
            onClick={() => endCall(call.id)}
            title="End call"
          >
            <PhoneHangupIcon size={22} />
            <span>End</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallScreen;
