export type SettingsPageId =
  | 'hub'
  | 'profile'
  | 'ptt'
  | 'privacy'
  | 'data'
  | 'devices'
  | 'about';

export interface DeviceSession {
  clientId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  app: string;
  connectedAt: string;
}
