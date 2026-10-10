import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';
import type { TripJob } from '../../services/orgService';
import { TRIP_STATUS, TRIP_STEPS, formatMMK } from '../../utils/tripUtils';
import { openMapsDirections } from '../../utils/phoneLinks';

interface Props {
  trip: TripJob;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: (next: string) => void;
  onChat: () => void;
  onCall: () => void;
  onCancel: () => void;
  onOfferExpired?: () => void;
  busy?: boolean;
}

function OfferCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired?: () => void }) {
  const deadline = new Date(expiresAt).getTime();
  const [total] = useState(() => Math.max(1, Math.round((deadline - Date.now()) / 1000)));
  const [left, setLeft] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1000)));

  useEffect(() => {
    if (left <= 0) {
      onExpired?.();
      return;
    }
    const t = setTimeout(() => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000))), 250);
    return () => clearTimeout(t);
  }, [left, deadline, onExpired]);

  const pct = Math.min(1, left / total);
  const urgent = left <= 10;
  return (
    <View style={styles.offer} accessibilityLiveRegion="polite">
      <View style={styles.offerHead}>
        <Ionicons name="flash" size={14} color={urgent ? T.danger : T.brand} />
        <Text style={[styles.offerText, urgent && { color: T.danger }]}>
          {left > 0 ? `Job အသစ် · ${left}s အတွင်း လက်ခံပါ` : 'အချိန်ကုန်သွားပါပြီ'}
        </Text>
      </View>
      <View style={styles.offerTrack}>
        <View style={[styles.offerBar, { width: `${pct * 100}%`, backgroundColor: urgent ? T.danger : T.brand }]} />
      </View>
    </View>
  );
}

const ACTIONS: Record<string, { label: string; next: string } | undefined> = {
  en_route: { label: 'ရောက်ရှိပြီ', next: 'arrived' },
  arrived: { label: 'ပြီးဆုံး', next: 'completed' },
};

const COMMS_STATUSES = new Set(['assigned', 'en_route', 'arrived']);

export default function TripJobCard({
  trip, onAccept, onReject, onAdvance, onChat, onCall, onCancel, onOfferExpired, busy,
}: Props) {
  const meta = TRIP_STATUS[trip.status] || { label: trip.status, labelMm: trip.status, color: T.textMuted };
  const action = ACTIONS[trip.status];
  const stepIdx = TRIP_STEPS.indexOf(trip.status as typeof TRIP_STEPS[number]);
  const canComms = COMMS_STATUSES.has(trip.status);
  const canCancel = trip.status === 'en_route' || trip.status === 'arrived';

  const hasMap = trip.pickupLat != null && trip.pickupLng != null;
  const region = hasMap
    ? {
        latitude: trip.driverLat ?? trip.pickupLat!,
        longitude: trip.driverLng ?? trip.pickupLng!,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : null;

  const confirmCancel = () => {
    Alert.alert('Cancel trip', 'ဤခရီးစဉ်ကို ပယ်ဖျက်မည်လား?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel trip', style: 'destructive', onPress: onCancel },
    ]);
  };

  return (
    <Card glow style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.customer}>{trip.customerName}</Text>
          <Text style={styles.tripMeta}>
            Kilo Taxi · {trip.bookingSource === 'customer' ? 'App' : 'Dispatch'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${meta.color}22` }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.labelMm}</Text>
        </View>
      </View>

      {trip.status === 'assigned' && trip.offerExpiresAt && (
        <OfferCountdown key={trip.offerExpiresAt} expiresAt={trip.offerExpiresAt} onExpired={onOfferExpired} />
      )}

      <View style={styles.steps}>
        {TRIP_STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.dot, stepIdx > i && styles.dotDone, stepIdx === i && styles.dotActive]} />
            {i < TRIP_STEPS.length - 1 && <View style={[styles.line, stepIdx > i && styles.lineDone]} />}
          </View>
        ))}
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <Ionicons name="radio-button-on" size={14} color={T.ptt} />
          <Text style={styles.routeText} numberOfLines={2}>{trip.pickupAddress}</Text>
        </View>
        <View style={styles.routeRow}>
          <Ionicons name="location" size={14} color={T.brand} />
          <Text style={styles.routeText} numberOfLines={2}>{trip.dropoffAddress}</Text>
        </View>
      </View>

      {trip.estimatedFare != null && (
        <Text style={styles.fare}>
          {formatMMK(trip.estimatedFare)}
          {trip.distanceKm != null ? ` · ${trip.distanceKm} km` : ''}
        </Text>
      )}

      {region && (
        <MapView style={styles.map} provider={PROVIDER_DEFAULT} region={region} scrollEnabled={false}>
          <Marker coordinate={{ latitude: trip.pickupLat!, longitude: trip.pickupLng! }} title="Pickup" pinColor={T.ptt} />
          {trip.dropoffLat != null && trip.dropoffLng != null && (
            <Marker coordinate={{ latitude: trip.dropoffLat, longitude: trip.dropoffLng }} title="Dropoff" pinColor={T.brand} />
          )}
          {trip.driverLat != null && trip.driverLng != null && (
            <Marker coordinate={{ latitude: trip.driverLat, longitude: trip.driverLng }} title="You">
              <View style={styles.driverPin}><Ionicons name="car" size={14} color="#fff" /></View>
            </Marker>
          )}
        </MapView>
      )}

      {canComms && (
        <View style={styles.contactRow}>
          <Button label="Voice" variant="ptt" onPress={onCall} style={styles.contactBtn} />
          <Button label="Chat" variant="outline" onPress={onChat} style={styles.contactBtn} />
        </View>
      )}

      {hasMap && trip.status === 'en_route' && (
        <Button
          label="Navigate"
          variant="ghost"
          onPress={() => openMapsDirections(trip.pickupLat!, trip.pickupLng!, trip.pickupAddress)}
          fullWidth
        />
      )}

      {trip.status === 'assigned' ? (
        <View style={styles.actionRow}>
          <Button label="လက်ခံမည်" variant="ptt" onPress={onAccept} loading={busy} style={styles.actionBtn} />
          <Button label="ငြင်းပယ်" variant="outline" onPress={onReject} disabled={busy} style={styles.actionBtn} />
        </View>
      ) : action ? (
        <Button label={action.label} variant="ptt" onPress={() => onAdvance(action.next)} loading={busy} fullWidth style={{ marginTop: S.md }} />
      ) : null}

      {canCancel && (
        <Button label="Cancel trip" variant="danger" onPress={confirmCancel} fullWidth style={{ marginTop: S.sm }} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: S.md },
  headerLeft: { flex: 1, marginRight: S.sm },
  customer: { fontSize: T.fsLg, fontWeight: '700', color: T.text },
  tripMeta: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: T.rFull },
  badgeText: { fontSize: T.fsXs, fontWeight: '700' },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md, paddingHorizontal: S.sm },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.borderStrong },
  dotDone: { backgroundColor: T.ptt },
  dotActive: { backgroundColor: T.brand, transform: [{ scale: 1.2 }] },
  line: { flex: 1, height: 2, backgroundColor: T.border, marginHorizontal: 2 },
  lineDone: { backgroundColor: T.pttDim },
  route: { gap: S.sm, marginBottom: S.sm },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  routeText: { flex: 1, fontSize: T.fsSm, color: T.text, lineHeight: 20 },
  fare: { fontSize: T.fsMd, fontWeight: '700', color: T.brand, marginBottom: S.sm },
  map: { height: 160, borderRadius: T.rMd, marginBottom: S.md, overflow: 'hidden' },
  driverPin: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  contactRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.sm },
  contactBtn: { flex: 1 },
  actionRow: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  actionBtn: { flex: 1 },
  offer: { backgroundColor: T.brandDim, borderRadius: T.rMd, padding: S.md, marginBottom: S.md },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.sm },
  offerText: { fontSize: T.fsSm, fontWeight: '700', color: T.brand },
  offerTrack: { height: 6, borderRadius: 3, backgroundColor: T.border, overflow: 'hidden' },
  offerBar: { height: 6, borderRadius: 3 },
});
