import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { pttService } from '../services/pttService';

export function useLocationSharing(channelId: string | null, enabled: boolean, status: string) {
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (channelId) {
      try {
        await pttService.clearLocation(channelId);
      } catch {
        // ignore
      }
    }
  }, [channelId]);

  useEffect(() => {
    if (!channelId || !enabled) {
      void stop();
      return;
    }

    let cancelled = false;

    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted' || cancelled) return;

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 25,
        },
        async (pos) => {
          try {
            await pttService.updateLocation(channelId, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: pos.coords.heading ?? 0,
              speed: (pos.coords.speed ?? 0) * 3.6,
              status,
            });
          } catch {
            // ignore
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [channelId, enabled, status, stop]);

  return { stopSharing: stop };
}
