import { Linking, Platform } from 'react-native';

export function callPhone(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  return Linking.openURL(`tel:${cleaned}`);
}

export function smsPhone(phone: string, body?: string) {
  const cleaned = phone.replace(/\s/g, '');
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = body
    ? `sms:${cleaned}${sep}body=${encodeURIComponent(body)}`
    : `sms:${cleaned}`;
  return Linking.openURL(url);
}

export function openMapsDirections(lat: number, lng: number, label?: string) {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url = Platform.select({
    ios: `maps:0,0?q=${q}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${q})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  return Linking.openURL(url!);
}
