import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  requestNotificationPermissions,
  getNotificationPermissionStatus,
} from '../../utils/notifications';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';
import { useUi } from '../../contexts/UiContext';

export default function NotificationSettingsCard() {
  const { showBanner, showError } = useUi();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const status = await getNotificationPermissionStatus();
      setEnabled(status === 'granted');
      setLoading(false);
    })();
  }, []);

  const onToggle = async (value: boolean) => {
    if (!value) {
      setEnabled(false);
      showBanner('Notifications disabled in system settings.', 'info');
      return;
    }
    try {
      const ok = await requestNotificationPermissions();
      setEnabled(ok);
      if (ok) showBanner('Notifications enabled for calls and messages.', 'success');
      else showBanner('Permission denied. Enable in device Settings.', 'warning', 8000);
    } catch (err) {
      showError(err, 'Could not update notification settings.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="notifications-outline" size={22} color={T.brand} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Push Notifications</Text>
        <Text style={styles.hint}>Calls, messages, and job alerts</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        disabled={loading}
        trackColor={{ false: T.border, true: T.brand }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.lg,
    paddingHorizontal: S.lg,
    gap: S.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: T.rSm,
    backgroundColor: T.brandDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: { fontSize: T.fsMd, fontWeight: '500', color: T.text },
  hint: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
});
