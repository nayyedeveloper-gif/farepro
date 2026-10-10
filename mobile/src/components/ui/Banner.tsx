import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { S, L } from '../../constants/layout';
import type { BannerType } from '../../contexts/UiContext';

const ICON: Record<BannerType, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  warning: 'warning',
  success: 'checkmark-circle',
  info: 'information-circle',
};

const BG: Record<BannerType, string> = {
  error: T.dangerDim,
  warning: 'rgba(243,156,18,0.12)',
  success: T.pttDim,
  info: T.brandDim,
};

const FG: Record<BannerType, string> = {
  error: T.danger,
  warning: T.busy,
  success: T.ptt,
  info: T.brand,
};

interface Props {
  type: BannerType;
  message: string;
  onDismiss?: () => void;
}

export default function Banner({ type, message, onDismiss }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: BG[type], borderColor: FG[type] }]}>
      <Ionicons name={ICON[type]} size={20} color={FG[type]} style={styles.icon} />
      <Text style={[styles.text, { color: T.text }]} numberOfLines={3}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.dismiss}>
          <Ionicons name="close" size={18} color={T.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: L.screenPadding,
    marginBottom: S.sm,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderRadius: T.rMd,
    borderWidth: 1,
  },
  icon: { marginRight: S.sm },
  text: { flex: 1, fontSize: T.fsSm, lineHeight: 18 },
  dismiss: { marginLeft: S.sm, padding: S.xs },
});
