import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { avatarColor, T } from '../../constants/design';

interface Props {
  name: string;
  size?: number;
  imageUrl?: string | null;
  online?: boolean;
}

export default function Avatar({ name, size = 48, imageUrl, online }: Props) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const bg = avatarColor(name);
  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: size * 0.28 }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]}>
          <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
        </View>
      )}
      {online !== undefined && (
        <View style={[styles.dot, online ? styles.online : styles.offline, { right: 0, bottom: 0 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: T.bg,
  },
  online: { backgroundColor: T.online },
  offline: { backgroundColor: T.offline },
});
