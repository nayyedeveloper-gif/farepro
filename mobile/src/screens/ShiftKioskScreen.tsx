import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import Banner from '../components/ui/Banner';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { orgService, type RetailShift } from '../services/orgService';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

const ROLES = ['cashier', 'stockroom', 'sales floor', 'manager', 'staff'];

export default function ShiftKioskScreen() {
  const router = useRouter();
  const { showError } = useUi();
  const [shift, setShift] = useState<RetailShift | null>(null);
  const [orgName, setOrgName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [roleLabel, setRoleLabel] = useState('staff');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctxRes = await orgService.getContext();
        if (!ctxRes.data?.hasOrg) {
          if (!cancelled) setError('Organization sign-in required');
          return;
        }
        const orgRes = await orgService.getOrg();
        setOrgName(orgRes.data?.name || '');
        const shiftRes = await orgService.getMyShift();
        if (shiftRes.data) setShift(shiftRes.data);
      } catch (err) {
        setError('Failed to load');
        showError(err, 'Could not load shift kiosk.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClockIn = async () => {
    if (!locationName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await orgService.clockIn({ locationName: locationName.trim(), roleLabel });
      setShift(res.data);
      setLocationName('');
    } catch (err: unknown) {
      setError('Clock in failed');
      showError(err, 'Clock in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    setBusy(true);
    try {
      await orgService.clockOut();
      setShift(null);
    } catch (err) {
      setError('Clock out failed');
      showError(err, 'Clock out failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar title="Shift Kiosk" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.org}>{orgName || 'Organization'}</Text>
        {error ? <Banner type="error" message={error} onDismiss={() => setError('')} /> : null}

        {loading ? (
          <Text style={styles.hint}>Loading...</Text>
        ) : shift ? (
          <Card glow style={styles.centerCard}>
            <Ionicons name="checkmark-circle" size={48} color={T.ptt} />
            <Text style={styles.onShift}>On Shift</Text>
            <Text style={styles.loc}>{shift.locationName}</Text>
            <Text style={styles.role}>{shift.roleLabel}</Text>
            <Button label="Clock Out" variant="danger" onPress={handleClockOut} loading={busy} fullWidth style={{ marginTop: 24 }} />
          </Card>
        ) : (
          <Card>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Store / site name"
              placeholderTextColor={T.textFaint}
              value={locationName}
              onChangeText={setLocationName}
            />
            <Text style={styles.label}>Role</Text>
            <View style={styles.chips}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, roleLabel === r && styles.chipOn]}
                  onPress={() => setRoleLabel(r)}
                >
                  <Text style={[styles.chipText, roleLabel === r && styles.chipTextOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button label="Clock In" onPress={handleClockIn} loading={busy} disabled={!locationName.trim()} fullWidth style={{ marginTop: 16 }} />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: L.screenPadding, paddingBottom: S.xxxl },
  org: { textAlign: 'center', color: T.brand, fontWeight: '600', marginBottom: 20 },
  error: { color: T.danger, textAlign: 'center', marginBottom: 12 },
  hint: { color: T.textMuted, textAlign: 'center' },
  centerCard: { alignItems: 'center', paddingVertical: 32 },
  onShift: { fontSize: T.fsXxl, fontWeight: '700', color: T.text, marginTop: 12 },
  loc: { fontSize: T.fsLg, color: T.text, marginTop: 8 },
  role: { fontSize: T.fsSm, color: T.textMuted, marginTop: 4 },
  label: { fontSize: T.fsSm, color: T.textSecondary, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.rMd,
    padding: 14,
    color: T.text,
    fontSize: T.fsMd,
    backgroundColor: T.surfaceGlass,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: T.rFull, borderWidth: 1, borderColor: T.border },
  chipOn: { borderColor: T.brand, backgroundColor: T.brandDim },
  chipText: { fontSize: T.fsXs, color: T.textMuted, textTransform: 'capitalize' },
  chipTextOn: { color: T.brand, fontWeight: '600' },
});
