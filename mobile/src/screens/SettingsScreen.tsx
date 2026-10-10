import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import SectionLabel from '../components/ui/SectionLabel';
import NotificationSettingsCard from '../components/ui/NotificationSettingsCard';
import { useAuth } from '../contexts/AuthContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

interface SettingsRowItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingsRow({ row, isLast }: { row: SettingsRowItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={row.onPress}
      activeOpacity={0.7}
      disabled={!row.onPress}
    >
      <View style={[styles.rowIcon, row.danger && styles.rowIconDanger]}>
        <Ionicons name={row.icon} size={18} color={row.danger ? T.danger : T.ptt} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, row.danger && { color: T.danger }]}>{row.label}</Text>
        {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
      </View>
      {!row.danger && <Ionicons name="chevron-forward" size={16} color={T.textFaint} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.username || '';

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const accountRows: SettingsRowItem[] = [
    { icon: 'person-circle-outline', label: 'My Profile', hint: 'Name, username, avatar', onPress: () => {} },
  ];

  const pttRows: SettingsRowItem[] = [
    { icon: 'mic-outline', label: 'PTT & Audio', hint: 'Mic sensitivity, speaker, release delay', onPress: () => {} },
    { icon: 'lock-closed-outline', label: 'Privacy and Security', hint: 'Phone, last seen, read receipts', onPress: () => {} },
    { icon: 'server-outline', label: 'Data and Storage', hint: 'Auto-download, cache', onPress: () => {} },
  ];

  const sessionRows: SettingsRowItem[] = [
    { icon: 'phone-portrait-outline', label: 'Active Devices', hint: 'Manage connected sessions', onPress: () => {} },
    { icon: 'information-circle-outline', label: 'About', hint: 'Version, terms, privacy policy', onPress: () => {} },
  ];

  return (
    <Screen>
      <AppBar title="Settings" variant="large" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={displayName} size={52} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              {user?.phone ? <Text style={styles.profileSub}>{user.phone}</Text> : null}
              <Text style={styles.profileSub}>@{user?.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={T.textFaint} />
          </View>
        </Card>

        <SectionLabel>Notifications</SectionLabel>
        <Card style={styles.sectionCard}>
          <NotificationSettingsCard />
        </Card>

        <SectionLabel>Account</SectionLabel>
        <Card style={styles.sectionCard}>
          {accountRows.map((row, i) => (
            <SettingsRow key={row.label} row={row} isLast={i === accountRows.length - 1} />
          ))}
        </Card>

        <SectionLabel>Push-to-Talk</SectionLabel>
        <Card style={styles.sectionCard}>
          {pttRows.map((row, i) => (
            <SettingsRow key={row.label} row={row} isLast={i === pttRows.length - 1} />
          ))}
        </Card>

        <SectionLabel>Sessions</SectionLabel>
        <Card style={styles.sectionCard}>
          {sessionRows.map((row, i) => (
            <SettingsRow key={row.label} row={row} isLast={i === sessionRows.length - 1} />
          ))}
        </Card>

        <Card style={styles.logoutCard}>
          <SettingsRow
            row={{ icon: 'log-out-outline', label: 'Sign out', danger: true, onPress: handleLogout }}
            isLast
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: S.xxxl },
  profileCard: { marginHorizontal: L.screenPadding, marginBottom: S.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  profileInfo: { flex: 1 },
  profileName: { fontSize: T.fsMd, fontWeight: '700', color: T.text },
  profileSub: { fontSize: T.fsSm, color: T.textMuted, marginTop: 2 },
  sectionCard: { marginHorizontal: L.screenPadding, marginBottom: S.sm, paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  logoutCard: { marginHorizontal: L.screenPadding, marginTop: S.md, paddingVertical: 0, paddingHorizontal: 0, borderColor: T.dangerDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: S.md + 2,
    minHeight: L.listItemMinHeight,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    marginLeft: 56,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: T.rSm,
    backgroundColor: T.pttDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: S.md,
  },
  rowIconDanger: { backgroundColor: T.dangerDim },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: T.fsMd, fontWeight: '500', color: T.text },
  rowHint: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
});
