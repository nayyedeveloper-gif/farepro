const DEVICE_ID_KEY = 'tg_device_id';

export interface DeviceMeta {
  deviceId: string;
  deviceName: string;
  platform: string;
  app: string;
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Web';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceMeta(): DeviceMeta {
  const platform = detectPlatform();
  const browser = detectBrowser();
  return {
    deviceId: getDeviceId(),
    deviceName: `${platform} · ${browser}`,
    platform,
    app: 'TeamLink Web',
  };
}

export function formatDeviceLabel(deviceName: string, platform: string): string {
  if (deviceName) return deviceName;
  return platform || 'Unknown device';
}
