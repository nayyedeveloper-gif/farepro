import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { T } from '../../constants/design';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: boolean;
}

export default function Card({ children, style, glow }: Props) {
  return (
    <View style={[styles.card, glow && styles.glow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.rLg,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  glow: {
    borderColor: T.brandGlow,
    shadowColor: T.brand,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
