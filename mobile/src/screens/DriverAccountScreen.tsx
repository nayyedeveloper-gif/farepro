import React from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import ListRow from '../components/ui/ListRow';
import { useAuth } from '../contexts/AuthContext';
import { orgService, type OrgContextResponse } from '../services/orgService';
import { useEffect, useState } from 'react';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

export default function DriverAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [orgCtx, setOrgCtx] = useState<OrgContextResponse | null>(null);

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.username || 'Driver';

  useEffect(() => {
    orgService.getContext()
      .then(res => setOrgCtx(res.data as OrgContextResponse))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign out', 'ထွက်မည်လား?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/org-login' as never);
        },
      },
    ]);
  };

  return (
    <Screen tabScreen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} glow>
          <View style={styles.profileRow}>
            <Avatar name={displayName} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profilePhone}>{user?.phone || user?.username}</Text>
              {orgCtx?.organization?.name && (
                <View style={styles.orgBadge}>
                  <Ionicons name="business-outline" size={12} color={T.brand} />
                  <Text style={styles.orgBadgeText}>{orgCtx.organization.name}</Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        <Text style={styles.section}>Kilo Taxi</Text>
        <Card style={styles.menuCard}>
          <ListRow
            icon="wallet-outline"
            label="Wallet"
            hint="Balance, commission & KBZPay / Wave top-up"
            onPress={() => router.push('/wallet' as never)}
          />
          <View style={styles.divider} />
          <ListRow
            icon="car-outline"
            label="Rides"
            hint="Active rides & history"
            onPress={() => router.push('/(tabs)/work' as never)}
          />
          <View style={styles.divider} />
          <ListRow
            icon="radio-outline"
            label="PTT Audio"
            hint="Dispatch radio mic & speaker"
            onPress={() => router.push('/settings' as never)}
          />
        </Card>

        <Card style={styles.logoutCard}>
          <ListRow icon="log-out-outline" label="Sign out" onPress={handleLogout} danger showChevron={false} />
        </Card>

        <View style={styles.footer}>
          <Ionicons name="car" size={18} color={T.brand} />
          <Text style={styles.footerText}>FarePro Driver · Kilo Taxi</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: L.screenPadding, paddingTop: S.lg, paddingBottom: S.sm },
  headerTitle: { fontSize: T.fsXxl, fontWeight: '800', color: T.text },
  profileCard: { marginHorizontal: L.screenPadding, marginBottom: S.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  profileInfo: { flex: 1 },
  profileName: { fontSize: T.fsLg, fontWeight: '700', color: T.text },
  profilePhone: { fontSize: T.fsSm, color: T.textMuted, marginTop: S.xs },
  orgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: S.sm,
    alignSelf: 'flex-start', backgroundColor: T.brandDim, paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: T.rFull,
  },
  orgBadgeText: { fontSize: T.fsXs, color: T.brand, fontWeight: '600' },
  section: {
    fontSize: T.fsXs, fontWeight: '600', color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginHorizontal: L.screenPadding + S.xs, marginBottom: S.sm,
  },
  menuCard: { marginHorizontal: L.screenPadding, marginBottom: S.lg, paddingVertical: S.xs, paddingHorizontal: 0 },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 70 },
  logoutCard: { marginHorizontal: L.screenPadding, marginBottom: S.xxxl, paddingVertical: S.xs, paddingHorizontal: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingBottom: S.xxxl },
  footerText: { fontSize: T.fsSm, color: T.textFaint },
});
