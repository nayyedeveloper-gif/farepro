import React, { useCallback, useEffect, useState } from 'react';
import { authAPI } from '../../../services/api';
import { getDeviceId, getDeviceMeta, formatDeviceLabel } from '../../../utils/deviceUtils';
import type { DeviceSession } from '../types';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import { DevicesIcon, LogOutIcon } from '../../icons/Icons';

interface DevicesPageProps {
  onBack: () => void;
}

function formatConnectedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'online';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'online';
  }
}

const DevicesPage: React.FC<DevicesPageProps> = ({ onBack }) => {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(false);
  const currentDeviceId = getDeviceId();
  const currentMeta = getDeviceMeta();

  const loadDevices = useCallback(async () => {
    try {
      const res = await authAPI.getDevices(currentDeviceId);
      setDevices(res.data.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [currentDeviceId]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const currentDevice = devices.find((d) => d.deviceId === currentDeviceId);
  const otherDevices = devices.filter((d) => d.deviceId !== currentDeviceId);

  const handleTerminate = async (clientId: string) => {
    setTerminating(true);
    try {
      await authAPI.terminateDevice(clientId);
      await loadDevices();
    } catch {
      // ignore
    } finally {
      setTerminating(false);
    }
  };

  const handleTerminateOthers = async () => {
    setTerminating(true);
    try {
      await authAPI.terminateOtherDevices(currentDeviceId);
      await loadDevices();
    } catch {
      // ignore
    } finally {
      setTerminating(false);
    }
  };

  return (
    <SettingsPageShell title="Devices" onBack={onBack}>
      <p className="tg-set-devices-intro">
        These are all devices currently signed into your account. You can terminate any session remotely.
      </p>

      <SettingsGroup label="This Device">
        <div className="tg-set-device-card current">
          <div className="tg-set-device-icon">
            <DevicesIcon size={22} />
          </div>
          <div className="tg-set-device-info">
            <span className="tg-set-device-name">
              {formatDeviceLabel(currentDevice?.deviceName || currentMeta.deviceName, currentMeta.platform)}
            </span>
            <span className="tg-set-device-meta tg-set-device-online">
              {currentDevice ? formatConnectedAt(currentDevice.connectedAt) : 'Active now'}
            </span>
            <span className="tg-set-device-app">{currentDevice?.app || currentMeta.app}</span>
          </div>
          <span className="tg-set-device-badge">this device</span>
        </div>
      </SettingsGroup>

      {!loading && otherDevices.length > 0 && (
        <SettingsGroup label="Active Sessions">
          {otherDevices.map((device) => (
            <div key={device.clientId} className="tg-set-device-card">
              <div className="tg-set-device-icon">
                <DevicesIcon size={22} />
              </div>
              <div className="tg-set-device-info">
                <span className="tg-set-device-name">
                  {formatDeviceLabel(device.deviceName, device.platform)}
                </span>
                <span className="tg-set-device-meta">{formatConnectedAt(device.connectedAt)}</span>
                <span className="tg-set-device-app">{device.app}</span>
              </div>
              <button
                type="button"
                className="tg-set-device-terminate"
                onClick={() => handleTerminate(device.clientId)}
                disabled={terminating}
              >
                Terminate
              </button>
            </div>
          ))}
        </SettingsGroup>
      )}

      {!loading && otherDevices.length === 0 && (
        <SettingsGroup label="Active Sessions">
          <p className="tg-set-devices-empty">No other active sessions.</p>
        </SettingsGroup>
      )}

      {otherDevices.length > 0 && (
        <div className="tg-set-hub-section tg-set-hub-danger">
          <button
            type="button"
            className="tg-set-terminate-all"
            onClick={handleTerminateOthers}
            disabled={terminating}
          >
            <LogOutIcon size={18} />
            <span>Terminate All Other Sessions</span>
          </button>
        </div>
      )}
    </SettingsPageShell>
  );
};

export default DevicesPage;
