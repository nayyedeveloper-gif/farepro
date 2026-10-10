import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../components/maps/AppMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { pttService } from '../services/pttService';
import { wsClient } from '../utils/websocket';
import { T } from '../constants/design';

const C = {
  bg: T.bg,
  card: T.surface,
  accent: T.ptt,
  busy: T.busy,
  brand: T.brand,
  text: T.text,
  textDim: T.textMuted,
  border: T.border,
};

const STATUS_COLOR: Record<string, string> = {
  available: C.accent,
  busy: C.busy,
  off: '#888',
};

export interface ChannelLocation {
  id: string;
  channelId: string;
  userId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  status: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

interface Props {
  channelId: string;
  channelName?: string;
  onClose?: () => void;
}

const FALLBACK_REGION = {
  latitude: 16.8661,
  longitude: 96.1951,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function ChannelFleetScreen({ channelId, channelName, onClose }: Props) {
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<ChannelLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [myRegion, setMyRegion] = useState(FALLBACK_REGION);

  const load = useCallback(async () => {
    try {
      const data = await pttService.getChannelLocations(channelId);
      setLocations(data);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMyRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        // keep fallback
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = wsClient.subscribe('channel.location', (data: unknown) => {
      const loc = data as ChannelLocation;
      if (loc.channelId !== channelId) return;
      setLocations(prev => {
        const filtered = prev.filter(l => l.userId !== loc.userId);
        return [...filtered, loc];
      });
    });
    const unsub2 = wsClient.subscribe('channel.location_cleared', (data: unknown) => {
      const payload = data as { userId: string };
      setLocations(prev => prev.filter(l => l.userId !== payload.userId));
    });
    return () => { unsub(); unsub2(); };
  }, [channelId]);

  useEffect(() => {
    if (viewMode !== 'map' || locations.length === 0 || !mapRef.current) return;
    const coords = locations.map(l => ({ latitude: l.latitude, longitude: l.longitude }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
      animated: true,
    });
  }, [locations, viewMode]);

  const openInMaps = (lat: number, lng: number, label: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  const centerOnMe = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      });
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{channelName || 'Fleet'}</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity onPress={() => setViewMode('map')} style={[styles.toggleBtn, viewMode === 'map' && styles.toggleActive]}>
            <Ionicons name="map" size={16} color={viewMode === 'map' ? C.accent : C.textDim} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}>
            <Ionicons name="list" size={16} color={viewMode === 'list' ? C.accent : C.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={myRegion}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {locations.map(loc => {
              const name = loc.user?.firstName || loc.user?.username || 'Driver';
              return (
                <Marker
                  key={loc.userId}
                  coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                  title={name}
                  description={`${loc.status} · ${(loc.speed || 0).toFixed(0)} km/h`}
                  pinColor={STATUS_COLOR[loc.status] || '#888'}
                  onCalloutPress={() => openInMaps(loc.latitude, loc.longitude, name)}
                />
              );
            })}
          </MapView>
          <TouchableOpacity style={styles.myLocBtn} onPress={() => { void centerOnMe(); }}>
            <Ionicons name="locate" size={20} color={C.text} />
          </TouchableOpacity>
          {locations.length === 0 && (
            <View style={styles.mapEmpty}>
              <Text style={styles.emptyText}>No drivers sharing location</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={48} color={C.textDim} />
              <Text style={styles.emptyText}>No drivers sharing location</Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.user?.firstName || item.user?.username || 'Driver';
            return (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>{item.status} · {(item.speed || 0).toFixed(0)} km/h</Text>
                </View>
                <TouchableOpacity style={styles.mapBtn} onPress={() => openInMaps(item.latitude, item.longitude, name)}>
                  <Ionicons name="navigate" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { flex: 1, color: C.text, fontSize: 17, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 8, padding: 2 },
  toggleBtn: { padding: 8, borderRadius: 6 },
  toggleActive: { backgroundColor: 'rgba(45,156,120,0.2)' },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  myLocBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmpty: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(17,24,33,0.92)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: C.textDim, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  cardInfo: { flex: 1 },
  name: { color: C.text, fontSize: 15, fontWeight: '600' },
  meta: { color: C.accent, fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  mapBtn: {
    backgroundColor: C.accent,
    padding: 12,
    borderRadius: 8,
  },
});
