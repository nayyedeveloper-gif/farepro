import React, { useState, useEffect } from 'react';
import { permissionService } from '../../services/PermissionService';
import { MicIcon, VideoIcon, BellIcon, XIcon, CheckIcon, AlertIcon } from '../icons/Icons';

interface PermissionModalProps {
  onClose: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ onClose }) => {
  const [audioPermission, setAudioPermission] = useState<PermissionState>('prompt');
  const [cameraPermission, setCameraPermission] = useState<PermissionState>('prompt');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [requesting, setRequesting] = useState('');

  useEffect(() => {
    setAudioPermission(permissionService.getAudioPermission());
    setCameraPermission(permissionService.getCameraPermission());
    setNotificationPermission(permissionService.getNotificationPermission());

    const unsubscribe = permissionService.subscribe(() => {
      setAudioPermission(permissionService.getAudioPermission());
      setCameraPermission(permissionService.getCameraPermission());
      setNotificationPermission(permissionService.getNotificationPermission());
    });

    return () => unsubscribe();
  }, []);

  const handleRequestAudio = async () => {
    setRequesting('audio');
    await permissionService.requestAudioPermission();
    setRequesting('');
  };

  const handleRequestCamera = async () => {
    setRequesting('camera');
    await permissionService.requestCameraPermission();
    setRequesting('');
  };

  const handleRequestNotification = async () => {
    setRequesting('notification');
    await permissionService.requestNotificationPermission();
    setRequesting('');
  };

  const handleRequestAll = async () => {
    setRequesting('all');
    await permissionService.requestAllPermissions();
    setRequesting('');
  };

  const getPermissionStatus = (permission: PermissionState | NotificationPermission) => {
    if (permission === 'granted') return 'granted';
    if (permission === 'denied') return 'denied';
    return 'prompt';
  };

  const allGranted = 
    audioPermission === 'granted' && 
    cameraPermission === 'granted' && 
    notificationPermission === 'granted';

  const PermissionCard: React.FC<{
    icon: React.ReactNode;
    name: string;
    description: string;
    permission: PermissionState | NotificationPermission;
    onRequest: () => void;
    requesting: boolean;
  }> = ({ icon, name, description, permission, onRequest, requesting }) => {
    const status = getPermissionStatus(permission);
    const isGranted = status === 'granted';
    const isDenied = status === 'denied';

    return (
      <div className={`perm-card ${status}`}>
        <div className="perm-card-icon">
          {icon}
        </div>
        <div className="perm-card-content">
          <div className="perm-card-header">
            <span className="perm-card-name">{name}</span>
            {isGranted && <CheckIcon size={16} className="perm-card-check" />}
            {isDenied && <AlertIcon size={16} className="perm-card-alert" />}
          </div>
          <span className="perm-card-desc">{description}</span>
        </div>
        {!isGranted && (
          <button 
            className={`perm-card-btn ${isDenied ? 'perm-card-btn--denied' : ''}`}
            onClick={onRequest}
            disabled={requesting}
          >
            {requesting ? '...' : isDenied ? 'Open Settings' : 'Allow'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay permission-modal-overlay" onClick={onClose}>
      <div className="modal-content permission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="perm-header">
          <div className="perm-header-icon">
            <BellIcon size={28} />
          </div>
          <div className="perm-header-content">
            <h2>Permissions Required</h2>
            <p>Grant permissions to enable all features</p>
          </div>
          <button className="perm-close" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div className="perm-body">
          <PermissionCard
            icon={<MicIcon size={24} />}
            name="Microphone"
            description="For voice calls and voice messages"
            permission={audioPermission}
            onRequest={handleRequestAudio}
            requesting={requesting === 'audio' || requesting === 'all'}
          />

          <PermissionCard
            icon={<VideoIcon size={24} />}
            name="Camera"
            description="For video calls"
            permission={cameraPermission}
            onRequest={handleRequestCamera}
            requesting={requesting === 'camera' || requesting === 'all'}
          />

          <PermissionCard
            icon={<BellIcon size={24} />}
            name="Notifications"
            description="To receive message alerts"
            permission={notificationPermission}
            onRequest={handleRequestNotification}
            requesting={requesting === 'notification' || requesting === 'all'}
          />
        </div>

        <div className="perm-footer">
          <button className="perm-btn perm-btn--secondary" onClick={onClose}>
            {allGranted ? 'Done' : 'Skip for now'}
          </button>
          {!allGranted && (
            <button 
              className="perm-btn perm-btn--primary" 
              onClick={handleRequestAll}
              disabled={requesting === 'all'}
            >
              {requesting === 'all' ? 'Requesting...' : 'Allow All'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;
