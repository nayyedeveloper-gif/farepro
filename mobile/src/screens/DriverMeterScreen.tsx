import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from '../components/maps/AppMap';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import { useFareMeter } from '../hooks/useFareMeter';
import { orgService } from '../services/orgService';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import {
  DEFAULT_FARE_RATES,
  formatDuration,
  formatKm,
  type FareRates,
} from '../utils/fareMeter';
import { formatMMK } from '../utils/tripUtils';

/**
 * Driver GPS fare meter — UX inspired by Bros-AI/FarePRO,
 * fare math aligned with Go backend services.CalculateFare.
 */
export default function DriverMeterScreen() {
  const router = useRouter();
  const { tripId, customerName, dropoff } = useLocalSearchParams<{
    tripId?: string;
    customerName?: string;
    dropoff?: string;
  }>();
  const { showError, showBanner } = useUi();
  const [rates, setRates] = useState<FareRates>(DEFAULT_FARE_RATES);
  const [saving, setSaving] = useState(false);

  const meter = useFareMeter(rates);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await orgService.getOrg();
        const org = res.data as {
          fareRatePerKm?: number;
          fareMinimum?: number;
          fareNightMultiplier?: number;
          fareNightStart?: number;
          fareNightEnd?: number;
        };
        if (cancelled || !org) return;
        setRates({
          ratePerKm: org.fareRatePerKm || DEFAULT_FARE_RATES.ratePerKm,
          minimumFare: org.fareMinimum || DEFAULT_FARE_RATES.minimumFare,
          nightMultiplier: org.fareNightMultiplier || DEFAULT_FARE_RATES.nightMultiplier,
          nightStartHour: org.fareNightStart ?? DEFAULT_FARE_RATES.nightStartHour,
          nightEndHour: org.fareNightEnd ?? DEFAULT_FARE_RATES.nightEndHour,
        });
      } catch {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const region = useMemo(() => {
    if (!meter.position) {
      return { latitude: 16.8661, longitude: 96.1951, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return {
      latitude: meter.position.lat,
      longitude: meter.position.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [meter.position]);

  const pathCoords = useMemo(
    () => meter.path.map(p => ({ latitude: p.lat, longitude: p.lng })),
    [meter.path],
  );

  const finishAndSave = useCallback(async () => {
    meter.stop();
    if (!tripId) {
      showBanner(`Meter stopped · ${formatMMK(meter.fareMmk)} · ${formatKm(meter.distanceKm)} km`, 'success');
      return;
    }
    setSaving(true);
    try {
      await orgService.updateTrip(tripId, {
        status: 'completed',
        distanceKm: meter.distanceKm,
        actualFare: meter.fareMmk,
      });
      showBanner(`Trip completed · ${formatMMK(meter.fareMmk)}`, 'success');
      router.back();
    } catch (err) {
      showError(err, 'Could not save fare to trip.');
    } finally {
      setSaving(false);
    }
  }, [meter, tripId, router, showBanner, showError]);

  const confirmFinish = () => {
    Alert.alert(
      'Finish meter',
      `Distance ${formatKm(meter.distanceKm)} km · Fare ${formatMMK(meter.fareMmk)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete trip', style: 'default', onPress: finishAndSave },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Fare Meter</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {customerName || 'Live GPS'}{dropoff ? ` · ${dropoff}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView style={styles.map} provider={PROVIDER_DEFAULT} region={region}>
          {pathCoords.length > 1 && (
            <Polyline coordinates={pathCoords} strokeColor={T.brand} strokeWidth={4} />
          )}
          {meter.position && (
            <Marker coordinate={{ latitude: meter.position.lat, longitude: meter.position.lng }}>
              <View style={styles.carPin}>
                <Ionicons name="car" size={16} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
        <View style={styles.speedBadge}>
          <Text style={styles.speedValue}>{meter.speedKmh}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      </View>

      <View style={styles.farePanel}>
        <Text style={styles.fareLabel}>TOTAL FARE</Text>
        <Text style={styles.fareAmount}>{formatMMK(meter.fareMmk)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatKm(meter.distanceKm)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDuration(meter.elapsedSec)}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{rates.ratePerKm}</Text>
            <Text style={styles.statLabel}>MMK/km</Text>
          </View>
        </View>
        {meter.error ? <Text style={styles.error}>{meter.error}</Text> : null}
      </View>

      <View style={styles.controls}>
        {!meter.running ? (
          <Button label="Start meter" variant="ptt" onPress={meter.start} fullWidth />
        ) : (
          <>
            <View style={styles.row}>
              {meter.paused ? (
                <Button label="Resume" variant="ptt" onPress={meter.resume} style={styles.half} />
              ) : (
                <Button label="Pause" variant="outline" onPress={meter.pause} style={styles.half} />
              )}
              <Button
                label={tripId ? 'Finish trip' : 'Stop'}
                variant="danger"
                onPress={confirmFinish}
                loading={saving}
                style={styles.half}
              />
            </View>
            <Button label="Reset" variant="ghost" onPress={meter.reset} fullWidth />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: L.screenPadding,
    paddingVertical: S.md,
    gap: S.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  backBtn: { padding: S.xs },
  headerText: { flex: 1 },
  title: { fontSize: T.fsLg, fontWeight: '700', color: T.text },
  sub: { fontSize: T.fsSm, color: T.textMuted, marginTop: 2 },
  mapWrap: { height: 260, position: 'relative' },
  map: { flex: 1 },
  speedBadge: {
    position: 'absolute',
    top: S.md,
    right: S.md,
    backgroundColor: 'rgba(8,12,16,0.85)',
    borderRadius: T.rMd,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
  speedValue: { fontSize: T.fsXl, fontWeight: '800', color: T.text },
  speedUnit: { fontSize: T.fsXs, color: T.textMuted },
  carPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  farePanel: {
    paddingHorizontal: L.screenPadding,
    paddingTop: S.lg,
    paddingBottom: S.md,
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: T.fsXs,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: T.textMuted,
  },
  fareAmount: {
    fontSize: T.fsHero,
    fontWeight: '800',
    color: T.brand,
    marginTop: S.xs,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: S.lg,
    gap: S.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    paddingVertical: S.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  statValue: { fontSize: T.fsLg, fontWeight: '700', color: T.text },
  statLabel: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
  error: { color: T.danger, marginTop: S.md, fontSize: T.fsSm },
  controls: {
    paddingHorizontal: L.screenPadding,
    paddingBottom: S.xxxl,
    gap: S.sm,
  },
  row: { flexDirection: 'row', gap: S.sm },
  half: { flex: 1 },
});
