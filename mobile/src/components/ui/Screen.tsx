import React from 'react';
import { View, StyleSheet, StatusBar, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../constants/design';
import { L } from '../../constants/layout';
import GlobalBanner from './GlobalBanner';

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
  /** Tab screens: skip bottom inset (tab bar handles it) */
  tabScreen?: boolean;
  showGlobalBanner?: boolean;
}

export default function Screen({
  children,
  padded,
  style,
  tabScreen = false,
  showGlobalBanner = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = tabScreen ? 0 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: bottomPad }, style]}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      {showGlobalBanner && <GlobalBanner />}
      <View style={[styles.body, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
  padded: { paddingHorizontal: L.screenPadding },
});
