import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import Screen from '../../components/ui/Screen';
import AppBar from '../../components/ui/AppBar';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import PlaceSearchField from '../../components/customer/PlaceSearchField';
import TripChatModal from '../../components/driver/TripChatModal';
import TripCallModal from '../../components/driver/TripCallModal';
import { bookingService, formatMMK, type PublicOrgInfo, type FareEstimate, type CustomerTrip } from '../../services/bookingService';
import { geocodeService, type PlaceResult } from '../../services/geocodeService';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';
import { driverDisplayName } from '../../utils/tripUtils';

const STATUS_LABELS: Record<string, string> = {
  requested: 'စောင့်ဆိုင်းနေသည် — dispatch ခန့်မှ job',
  pending: 'စောင့်ဆိုင်းနေသည်',
  assigned: 'ယာဉ်ခန့်ထားပြီး — driver accept စောင့်',
  en_route: 'လာရောက်နေသည်',
  arrived: 'ရောက်ရှိပြီး',
  completed: 'ပြီးဆုံး',
  cancelled: 'ပယ်ဖျက်',
};

export default function BookRideScreen() {
  const { subdomain: subParam } = useLocalSearchParams<{ subdomain?: string }>();
  const subdomain = (subParam || '').toLowerCase();
  const router = useRouter();

  const [org, setOrg] = useState<PublicOrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [dropoff, setDropoff] = useState<PlaceResult | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const [bookedTrip, setBookedTrip] = useState<CustomerTrip | null>(null);
  const [trackingPhone, setTrackingPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    bookingService.getOrg(subdomain)
      .then(res => setOrg(res.data))
      .catch(() => setError('Taxi service မတွေ့ပါ'))
      .finally(() => setLoading(false));
  }, [subdomain]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    bookingService.estimate(subdomain, {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
    })
      .then(res => { if (!cancelled) setEstimate(res.data); })
      .catch(() => { if (!cancelled) setError('အကွာအဝေး/ဈေး တွက်မရပါ'); })
      .finally(() => { if (!cancelled) setEstimating(false); });
    return () => { cancelled = true; };
  }, [pickup, dropoff, subdomain]);

  const refreshStatus = useCallback(async () => {
    if (!bookedTrip || !trackingPhone) return;
    try {
      const res = await bookingService.getRideStatus(subdomain, bookedTrip.id, trackingPhone);
      setBookedTrip(res.data);
    } catch { /* ignore */ }
  }, [bookedTrip, trackingPhone, subdomain]);

  useEffect(() => {
    if (!bookedTrip || bookedTrip.status === 'completed' || bookedTrip.status === 'cancelled') return;
    const ms = ['en_route', 'arrived'].includes(bookedTrip.status) ? 5000 : 8000;
    const t = setInterval(refreshStatus, ms);
    return () => clearInterval(t);
  }, [bookedTrip, refreshStatus]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await geocodeService.reverse(pos.coords.latitude, pos.coords.longitude);
      setPickup(res.data);
    } catch {
      setError('လက်ရှိနေရာ မရနိုင်ပါ — location permission ဖွင့်ပါ');
    } finally {
      setLocating(false);
    }
  };

  const handleBook = async () => {
    if (!estimate || !pickup || !dropoff || !customerName.trim() || !customerPhone.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await bookingService.createRide(subdomain, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupAddress: pickup.shortName,
        dropoffAddress: dropoff.shortName,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        paymentMethod: 'cash',
      });
      setBookedTrip(res.data);
      setTrackingPhone(customerPhone.trim());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Booking မအောင်မြင်ပါ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppBar title="Loading…" />
        <Text style={styles.hint}>Stand loading…</Text>
      </Screen>
    );
  }

  if (!org?.bookingEnabled) {
    return (
      <Screen>
        <AppBar title="Unavailable" />
        <Card style={styles.card}><Text style={styles.hint}>Booking ပိတ်ထားပါသည်</Text></Card>
        <Button label="Back" variant="outline" onPress={() => router.back()} style={styles.backBtn} />
      </Screen>
    );
  }

  if (bookedTrip) {
    const statusLabel = STATUS_LABELS[bookedTrip.status] || bookedTrip.status;
    const driverName = driverDisplayName(bookedTrip.driver);
    const canComms = ['assigned', 'en_route', 'arrived'].includes(bookedTrip.status);
    const showMap = bookedTrip.pickupLat != null && bookedTrip.pickupLng != null;
    const mapRegion = showMap ? {
      latitude: bookedTrip.driverLat ?? bookedTrip.pickupLat!,
      longitude: bookedTrip.driverLng ?? bookedTrip.pickupLng!,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    } : null;

    return (
      <Screen>
        <AppBar title={org.name} subtitle="ခရီးစဉ် အခြေအနေ" variant="large" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshStatus(); setRefreshing(false); }} tintColor={T.brand} />
          }
        >
          <Card style={styles.card} glow>
            <Text style={styles.statusBadge}>{statusLabel}</Text>
            <Text style={styles.route}>{bookedTrip.pickupAddress}</Text>
            <Text style={styles.routeDim}>→ {bookedTrip.dropoffAddress}</Text>
            {bookedTrip.estimatedFare != null && (
              <Text style={styles.fare}>{formatMMK(bookedTrip.estimatedFare)}{bookedTrip.distanceKm != null ? ` · ${bookedTrip.distanceKm} km` : ''}</Text>
            )}
          {driverName ? <Text style={styles.driver}>ယာဉ်မောင်း: {driverName}</Text> : null}
            <Text style={styles.tripId}>#{bookedTrip.id.slice(0, 8)}</Text>
          </Card>

          {mapRegion && (
            <MapView style={styles.map} provider={PROVIDER_DEFAULT} region={mapRegion}>
              <Marker coordinate={{ latitude: bookedTrip.pickupLat!, longitude: bookedTrip.pickupLng! }} title="Pickup" pinColor={T.ptt} />
              {bookedTrip.dropoffLat != null && bookedTrip.dropoffLng != null && (
                <Marker coordinate={{ latitude: bookedTrip.dropoffLat, longitude: bookedTrip.dropoffLng }} title="Dropoff" pinColor={T.brand} />
              )}
              {bookedTrip.driverLat != null && bookedTrip.driverLng != null && (
                <Marker coordinate={{ latitude: bookedTrip.driverLat, longitude: bookedTrip.driverLng }} title="Driver" pinColor="#3b82f6" />
              )}
            </MapView>
          )}

          {canComms && (
            <View style={styles.contactRow}>
              <Button label="Voice call" variant="ptt" onPress={() => setCallOpen(true)} style={styles.contactBtn} />
              <Button label="Chat" variant="outline" onPress={() => setChatOpen(true)} style={styles.contactBtn} />
            </View>
          )}

          <Button label="Refresh" variant="outline" onPress={refreshStatus} fullWidth style={styles.backBtn} />
          <Button label="မှာယူမှု အသစ်" onPress={() => { setBookedTrip(null); setPickup(null); setDropoff(null); }} fullWidth />

          <TripChatModal
            visible={chatOpen}
            tripId={bookedTrip.id}
            title={driverName || 'Driver'}
            role="customer"
            subdomain={subdomain}
            phone={trackingPhone}
            onClose={() => setChatOpen(false)}
          />
          <TripCallModal
            visible={callOpen}
            tripId={bookedTrip.id}
            title={driverName || 'Driver'}
            role="customer"
            subdomain={subdomain}
            phone={trackingPhone}
            onClose={() => setCallOpen(false)}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={org.customerAppTitle || org.name} subtitle={`@${subdomain}`} variant="large" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Input label="အမည်" placeholder="Your name" value={customerName} onChangeText={setCustomerName} />
        <Input label="ဖုန်း" placeholder="09xxxxxxxxx" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />

        <Button label={locating ? 'Locating…' : 'လက်ရှိနေရာ'} variant="outline" onPress={handleUseMyLocation} loading={locating} fullWidth style={{ marginBottom: S.md }} />

        <PlaceSearchField label="ထွက်ရန်" placeholder="Pickup address" value={pickup} onChange={setPickup} />
        <PlaceSearchField label="ရောက်ရန်" placeholder="Dropoff address" value={dropoff} onChange={setDropoff} />

        <Card style={styles.card}>
          {estimating ? (
            <Text style={styles.hint}>ဈေး တွက်နေသည်…</Text>
          ) : estimate ? (
            <>
              <Text style={styles.fareLabel}>ခန့်မှန်းဈေး</Text>
              <Text style={styles.fareBig}>{formatMMK(estimate.estimatedFare)}</Text>
              <Text style={styles.hint}>{estimate.distanceKm} km · min {formatMMK(estimate.minimumFare)}</Text>
            </>
          ) : (
            <Text style={styles.hint}>ထွက်ရန်/ရောက်ရန် ရွေးပါ — km နှင့် ဈေး auto တွက်မည်</Text>
          )}
        </Card>

        <Button
          label="မှာယူမည်"
          onPress={handleBook}
          loading={submitting}
          disabled={!estimate || !customerName.trim() || !customerPhone.trim()}
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: L.screenPadding, paddingBottom: S.xxxl },
  card: { marginBottom: S.md },
  hint: { fontSize: T.fsSm, color: T.textMuted, lineHeight: 20, padding: L.screenPadding },
  error: { color: T.danger, fontSize: T.fsSm, marginBottom: S.md },
  fareLabel: { fontSize: T.fsSm, color: T.textMuted },
  fareBig: { fontSize: T.fsXxl, fontWeight: '700', color: T.brand, marginVertical: S.xs },
  statusBadge: { fontSize: T.fsLg, fontWeight: '700', color: T.brand, marginBottom: S.md },
  route: { fontSize: T.fsMd, color: T.text },
  routeDim: { fontSize: T.fsSm, color: T.textMuted, marginTop: 2, marginBottom: S.sm },
  fare: { fontSize: T.fsMd, fontWeight: '700', color: T.ptt },
  driver: { fontSize: T.fsSm, color: T.textSecondary, marginTop: S.sm },
  tripId: { fontSize: T.fsXs, color: T.textFaint, marginTop: S.md },
  backBtn: { marginBottom: S.md },
  map: { height: 200, borderRadius: T.rLg, marginBottom: S.md, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },
  contactBtn: { flex: 1 },
});
