import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Vibration } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from '../components/maps/AppMap';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/ui/Screen';
import EmptyState from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import SegmentedControl from '../components/ui/SegmentedControl';
import TripJobCard from '../components/driver/TripJobCard';
import TripChatModal from '../components/driver/TripChatModal';
import TripCallModal from '../components/driver/TripCallModal';
import { orgService, type TripJob, type OrgContextResponse } from '../services/orgService';
import { tripCommsService } from '../services/tripCommsService';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { wsClient } from '../utils/websocket';
import { useTripLocationSharing } from '../hooks/useTripLocationSharing';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import { TRIP_STATUS, formatMMK } from '../utils/tripUtils';

const YANGON = { latitude: 16.8661, longitude: 96.1951, latitudeDelta: 0.12, longitudeDelta: 0.12 };

type Tab = 'active' | 'history' | 'map';

export default function DriverJobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showBanner } = useUi();
  const [tab, setTab] = useState<Tab>('active');
  const [orgCtx, setOrgCtx] = useState<OrgContextResponse | null>(null);
  const [trips, setTrips] = useState<TripJob[]>([]);
  const [history, setHistory] = useState<TripJob[]>([]);
  const [fleet, setFleet] = useState<{ drivers: any[]; heat: any[] }>({ drivers: [], heat: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [commsTrip, setCommsTrip] = useState<TripJob | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const activeTrip = trips[0] ?? null;
  const shareLocation = activeTrip?.status === 'en_route' || activeTrip?.status === 'arrived';
  useTripLocationSharing(activeTrip?.id ?? null, !!shareLocation);

  const load = useCallback(async () => {
    try {
      const ctxRes = await orgService.getContext();
      const ctx = ctxRes.data as OrgContextResponse;
      if (!ctx?.hasOrg) {
        setOrgCtx(null);
        return;
      }
      setOrgCtx(ctx);
      const [tripsRes, histRes, mapRes] = await Promise.all([
        orgService.getTrips(),
        tripCommsService.getHistory(),
        tripCommsService.getFleetMap(),
      ]);
      setTrips(tripsRes.data || []);
      setHistory(histRes.data || []);
      setFleet(mapRes.data || { drivers: [], heat: [] });
    } catch (err) {
      showError(err, 'Could not load jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!orgCtx?.hasOrg) return;
    const unsubOffer = wsClient.subscribe('trip.offer', (data: unknown) => {
      const payload = data as { trip?: TripJob; expiresAt?: string };
      const trip = payload?.trip;
      if (!trip?.id) return;
      const offered = { ...trip, offerExpiresAt: payload.expiresAt || trip.offerExpiresAt };
      setTrips(prev => [offered, ...prev.filter(t => t.id !== trip.id)]);
      setTab('active');
      Vibration.vibrate([0, 400, 200, 400]);
    });
    const unsubExpired = wsClient.subscribe('trip.offer_expired', (data: unknown) => {
      const tripId = (data as { tripId?: string })?.tripId;
      if (!tripId) return;
      setTrips(prev => prev.filter(t => t.id !== tripId));
      showBanner('Job offer အချိန်ကုန်သွားပါပြီ — နောက် driver ထံ ပို့လိုက်ပါပြီ', 'info', 4000);
    });
    const unsub = wsClient.subscribe('trip.updated', (data: unknown) => {
      const trip = data as TripJob;
      if (!trip?.id) return;
      if (trip.driverId !== user?.id) {
        setTrips(prev => prev.filter(t => t.id !== trip.id));
        return;
      }
      setTrips(prev => {
        if (trip.status === 'completed' || trip.status === 'cancelled') {
          return prev.filter(t => t.id !== trip.id);
        }
        const idx = prev.findIndex(t => t.id === trip.id);
        if (idx === -1) return [trip, ...prev];
        const next = [...prev];
        next[idx] = { ...trip, offerExpiresAt: trip.offerExpiresAt ?? prev[idx].offerExpiresAt };
        return next;
      });
      if (trip.status === 'completed' || trip.status === 'cancelled') {
        setHistory(prev => [trip, ...prev]);
      }
    });
    return () => { unsub(); unsubOffer(); unsubExpired(); };
  }, [orgCtx?.hasOrg, user?.id, showBanner]);

  const handleAccept = async (tripId: string) => {
    setActionBusy(true);
    try {
      const res = await orgService.acceptTrip(tripId);
      setTrips(prev => prev.map(t => t.id === tripId ? res.data : t));
    } catch (err) {
      showError(err, 'Could not accept job.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (tripId: string) => {
    setActionBusy(true);
    try {
      await orgService.rejectTrip(tripId);
      setTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (err) {
      showError(err, 'Could not decline job.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdvance = async (tripId: string, status: string) => {
    setActionBusy(true);
    try {
      await orgService.updateTrip(tripId, { status });
      if (status === 'completed') {
        await load();
      } else {
        await load();
      }
    } catch (err) {
      showError(err, 'Could not update job.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async (tripId: string) => {
    setActionBusy(true);
    try {
      await tripCommsService.cancelTrip(tripId, 'Driver cancelled');
      setTrips(prev => prev.filter(t => t.id !== tripId));
      await load();
    } catch (err) {
      showError(err, 'Could not cancel trip.');
    } finally {
      setActionBusy(false);
    }
  };

  const driverName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.username || 'Driver';

  if (loading) {
    return (
      <Screen tabScreen>
        <View style={styles.topBar}><Text style={styles.loadingText}>Loading…</Text></View>
      </Screen>
    );
  }

  if (!orgCtx?.hasOrg) {
    return (
      <Screen tabScreen>
        <EmptyState
          icon="car-outline"
          title="Driver sign in required"
          subtitle="Org account ဖြင့် ဝင်ရောက်ပါ"
          actionLabel="Sign In"
          onAction={() => router.push('/org-login' as never)}
        />
      </Screen>
    );
  }

  return (
    <Screen tabScreen>
      <View style={styles.topBar}>
        <View style={styles.orgRow}>
          <View style={styles.orgIcon}><Ionicons name="business" size={18} color={T.brand} /></View>
          <View style={styles.orgInfo}>
            <Text style={styles.orgName}>{orgCtx.organization?.name}</Text>
            <Text style={styles.driverLine}>{driverName} · Kilo Taxi</Text>
          </View>
        </View>
        <SegmentedControl
          options={[
            { label: 'Active', value: 'active' },
            { label: 'History', value: 'history' },
            { label: 'Map', value: 'map' },
          ]}
          value={tab}
          onChange={v => setTab(v as Tab)}
        />
      </View>

      {tab === 'map' ? (
        <MapView style={styles.fullMap} provider={PROVIDER_DEFAULT} initialRegion={YANGON}>
          {fleet.heat.map((p, i) => (
            <Circle
              key={`h-${i}`}
              center={{ latitude: p.lat, longitude: p.lng }}
              radius={80 + p.weight * 40}
              fillColor="rgba(242,101,34,0.15)"
              strokeColor="rgba(242,101,34,0.35)"
            />
          ))}
          {fleet.drivers.map(d => (
            <Marker
              key={d.tripId}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
              title={`${d.firstName} ${d.lastName}`.trim()}
              description={d.status}
            />
          ))}
        </MapView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.brand} />
          }
        >
          {tab === 'active' && (
            trips.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="car-outline" size={48} color={T.textFaint} />
                <Text style={styles.emptyTitle}>No active jobs</Text>
                <Text style={styles.emptySub}>Wait for dispatch to assign a kilo ride</Text>
              </View>
            ) : (
              trips.map(trip => (
                <TripJobCard
                  key={trip.id}
                  trip={trip}
                  busy={actionBusy}
                  onAccept={() => handleAccept(trip.id)}
                  onReject={() => handleReject(trip.id)}
                  onAdvance={(next) => handleAdvance(trip.id, next)}
                  onChat={() => { setCommsTrip(trip); setChatOpen(true); }}
                  onCall={() => { setCommsTrip(trip); setCallOpen(true); }}
                  onCancel={() => handleCancel(trip.id)}
                  onMeter={() =>
                    router.push({
                      pathname: '/meter',
                      params: {
                        tripId: trip.id,
                        customerName: trip.customerName,
                        dropoff: trip.dropoffAddress,
                      },
                    } as never)
                  }
                  onOfferExpired={() => setTrips(prev => prev.filter(t => t.id !== trip.id || t.status !== 'assigned'))}
                />
              ))
            )
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <Text style={styles.emptySub}>No completed or cancelled jobs yet</Text>
            ) : (
              history.map(trip => {
                const meta = TRIP_STATUS[trip.status] || { labelMm: trip.status, color: T.textMuted };
                return (
                  <Card key={trip.id} style={styles.histCard}>
                    <Text style={styles.histName}>{trip.customerName}</Text>
                    <Text style={styles.histRoute} numberOfLines={1}>{trip.pickupAddress}</Text>
                    <View style={styles.histFooter}>
                      <Text style={[styles.histStatus, { color: meta.color }]}>{meta.labelMm}</Text>
                      {trip.estimatedFare != null && <Text style={styles.histFare}>{formatMMK(trip.estimatedFare)}</Text>}
                    </View>
                  </Card>
                );
              })
            )
          )}
        </ScrollView>
      )}

      {commsTrip && (
        <>
          <TripChatModal
            visible={chatOpen}
            tripId={commsTrip.id}
            title={commsTrip.customerName}
            role="driver"
            onClose={() => setChatOpen(false)}
          />
          <TripCallModal
            visible={callOpen}
            tripId={commsTrip.id}
            title={commsTrip.customerName}
            role="driver"
            onClose={() => setCallOpen(false)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: L.screenPadding,
    paddingTop: S.md,
    paddingBottom: S.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  orgIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim,
    alignItems: 'center', justifyContent: 'center',
  },
  orgInfo: { flex: 1 },
  orgName: { fontSize: T.fsLg, fontWeight: '700', color: T.text },
  driverLine: { fontSize: T.fsSm, color: T.textMuted, marginTop: 2 },
  scroll: { paddingTop: S.md, paddingBottom: S.xxxl },
  fullMap: { flex: 1 },
  loadingText: { color: T.textMuted, padding: L.screenPadding },
  emptyWrap: { alignItems: 'center', paddingHorizontal: L.screenPadding, paddingTop: 48 },
  emptyTitle: { fontSize: T.fsXl, fontWeight: '700', color: T.text, marginTop: S.lg },
  emptySub: { fontSize: T.fsSm, color: T.textMuted, textAlign: 'center', lineHeight: 22, marginTop: S.sm, paddingHorizontal: L.screenPadding },
  histCard: { marginHorizontal: L.screenPadding, marginBottom: S.sm },
  histName: { fontSize: T.fsMd, fontWeight: '600', color: T.text },
  histRoute: { fontSize: T.fsSm, color: T.textMuted, marginTop: 4 },
  histFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: S.sm },
  histStatus: { fontSize: T.fsSm, fontWeight: '600' },
  histFare: { fontSize: T.fsSm, color: T.brand, fontWeight: '700' },
});
