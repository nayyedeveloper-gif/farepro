import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';
import Button from './Button';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function EmptyState({
  icon, title, subtitle, actionLabel, onAction, secondaryLabel, onSecondary,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={40} color={T.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: S.xl, minWidth: 200 }} />
      )}
      {secondaryLabel && onSecondary && (
        <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} style={{ marginTop: S.md }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: S.xxl, paddingTop: 72, paddingBottom: S.xxxl },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.lg,
  },
  title: { fontSize: T.fsLg, fontWeight: '600', color: T.text, textAlign: 'center' },
  sub: { fontSize: T.fsSm, color: T.textMuted, textAlign: 'center', marginTop: S.sm, lineHeight: 20 },
});
