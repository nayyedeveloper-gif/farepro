import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};

const DEFAULT_API = 'https://teamwork.29jewellery.com/api';
const DEFAULT_WS = 'wss://teamwork.29jewellery.com/ws';

/** Set EXPO_PUBLIC_USE_LOCAL_API=1 in .env to hit a machine on your LAN */
const USE_LOCAL = process.env.EXPO_PUBLIC_USE_LOCAL_API === '1';

const configuredApi =
  process.env.EXPO_PUBLIC_API_URL ||
  (extra.apiUrl as string | undefined) ||
  DEFAULT_API;

const configuredWs =
  process.env.EXPO_PUBLIC_WS_URL ||
  (extra.wsUrl as string | undefined) ||
  DEFAULT_WS;

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.0.102';

function getLocalUrl(port: number, protocol: 'http' | 'ws') {
  if (Platform.OS === 'ios') {
    return `${protocol}://localhost:${port}`;
  }
  const androidHost = (extra.androidHost as string | undefined) || LOCAL_IP;
  return `${protocol}://${androidHost}:${port}`;
}

const LOCAL_API = `${getLocalUrl(8080, 'http')}/api`;
const LOCAL_WS = `${getLocalUrl(8080, 'ws')}/ws`;

const API_URL = USE_LOCAL ? LOCAL_API : configuredApi;
const WS_URL = USE_LOCAL ? LOCAL_WS : configuredWs;

export { API_URL, WS_URL };
