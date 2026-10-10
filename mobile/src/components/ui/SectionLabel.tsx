import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';

export default function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: T.fsXs,
    fontWeight: '600',
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: L.screenPadding,
    marginTop: S.lg,
    marginBottom: S.sm,
  },
});
