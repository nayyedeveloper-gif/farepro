import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { L } from '../../constants/layout';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export default function IconButton({
  icon, onPress, color = T.textSecondary, size = 22, style, accessibilityLabel,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.btn, style]}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: L.iconButtonSize,
    height: L.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
