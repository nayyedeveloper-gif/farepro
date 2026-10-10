import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { T } from '../../constants/design';

type Variant = 'brand' | 'ptt' | 'ghost' | 'danger' | 'outline';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({
  label, onPress, variant = 'brand', loading, disabled, style, fullWidth,
}: Props) {
  const v = styles[variant];
  return (
    <TouchableOpacity
      style={[styles.base, v, fullWidth && styles.full, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && styles.labelGhost, variant === 'outline' && styles.labelOutline]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: T.rMd,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontSize: T.fsMd, fontWeight: '600' },
  labelGhost: { color: T.brand },
  labelOutline: { color: T.text },
  brand: { backgroundColor: T.brand },
  ptt: { backgroundColor: T.ptt },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: T.danger },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
});
