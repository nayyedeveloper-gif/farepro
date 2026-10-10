import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';
import IconButton from './IconButton';

export interface AppBarAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  actions?: AppBarAction[];
  style?: ViewStyle;
  variant?: 'large' | 'compact';
  bordered?: boolean;
}

export default function AppBar({
  title,
  subtitle,
  onBack,
  right,
  actions,
  style,
  variant = 'compact',
  bordered = true,
}: Props) {
  const isLarge = variant === 'large';

  return (
    <View style={[styles.wrap, bordered && styles.bordered, style]}>
      <View style={styles.row}>
        {onBack ? (
          <IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Go back" />
        ) : (
          <View style={styles.sideSpacer} />
        )}

        {!isLarge && (
          <View style={styles.center}>
            <Text style={styles.titleCompact} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        )}

        {isLarge && <View style={styles.flex} />}

        <View style={styles.right}>
          {actions?.map((a) => (
            <IconButton
              key={a.icon + (a.accessibilityLabel || '')}
              icon={a.icon}
              onPress={a.onPress}
              accessibilityLabel={a.accessibilityLabel}
            />
          ))}
          {right}
          {!right && !actions?.length && <View style={styles.sideSpacer} />}
        </View>
      </View>

      {isLarge && (
        <View style={styles.largeBlock}>
          <Text style={styles.titleLarge}>{title}</Text>
          {subtitle ? <Text style={styles.subtitleLarge}>{subtitle}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: L.screenPadding - 4,
    paddingBottom: S.md,
    minHeight: L.appBarHeight,
    justifyContent: 'center',
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.borderStrong,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: L.appBarHeight,
  },
  sideSpacer: { width: L.iconButtonSize },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: S.sm },
  right: { flexDirection: 'row', alignItems: 'center' },
  titleCompact: { fontSize: T.fsLg, fontWeight: '600', color: T.text },
  titleLarge: { fontSize: T.fsXxl, fontWeight: '700', color: T.text, letterSpacing: -0.3 },
  subtitle: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2, textAlign: 'center' },
  subtitleLarge: { fontSize: T.fsSm, color: T.textMuted, marginTop: S.xs },
  largeBlock: { paddingHorizontal: S.xs, paddingBottom: S.xs },
});

// Back-compat alias
export { AppBar as AppHeader };
