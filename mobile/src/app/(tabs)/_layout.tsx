import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';
import { isDriverApp } from '../../config/appVariant';

function TabIcon({ name, color, focused, ptt }: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  focused: boolean;
  ptt?: boolean;
}) {
  if (ptt && focused) {
    return (
      <View style={styles.pttFab}>
        <Ionicons name={name} size={26} color="#fff" />
      </View>
    );
  }
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabPadBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? S.sm : S.md);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { height: L.tabBarHeight + tabPadBottom, paddingBottom: tabPadBottom },
        ],
        tabBarActiveTintColor: T.brand,
        tabBarInactiveTintColor: T.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="ptt"
        options={{
          title: 'PTT',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="radio" color={color} focused={focused} ptt />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Rides',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="car" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          href: isDriverApp ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="contacts" options={{ href: null }} />
      <Tabs.Screen name="calls" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: T.tabBg,
    borderTopColor: T.borderStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: S.sm,
  },
  tabLabel: { fontSize: T.fsXs, fontWeight: '600', marginTop: 2 },
  tabItem: { paddingTop: S.xs },
  pttFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: T.brand,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
