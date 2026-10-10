/**
 * Web stub for react-native-maps — native maps use codegenNativeComponent
 * which is unavailable on react-native-web.
 */
import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '../../constants/design';

export const PROVIDER_DEFAULT = undefined;

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  region?: Region;
  initialRegion?: Region;
  provider?: unknown;
  scrollEnabled?: boolean;
  children?: ReactNode;
};

export default function MapView({ style, region, initialRegion, children }: MapViewProps) {
  const r = region || initialRegion;
  return (
    <View style={[styles.map, style]}>
      <Text style={styles.label}>Map preview (native only)</Text>
      {r ? (
        <Text style={styles.coords}>
          {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
        </Text>
      ) : null}
      <View style={styles.children}>{children}</View>
    </View>
  );
}

export function Marker(_props: {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  children?: ReactNode;
}) {
  return null;
}

export function Polyline(_props: {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
}) {
  return null;
}

export function Circle(_props: {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
}) {
  return null;
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: { color: T.textMuted, fontSize: T.fsSm, fontWeight: '600' },
  coords: { color: T.textFaint, fontSize: T.fsXs, marginTop: 4 },
  children: { display: 'none' },
});
