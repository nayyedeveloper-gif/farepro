import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { orgService } from '../services/orgService';

/** Share GPS with backend while driver is on an active trip */
export function useTripLocationSharing(tripId: string | null, enabled: boolean) {
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tripId || !enabled) {
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
          timeInterval: 12000,
          distanceInterval: 20,
        },
        async (pos) => {
          try {
            await orgService.updateTripLocation(tripId, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          } catch {
            // ignore transient errors
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [tripId, enabled, stop]);

  return { stopSharing: stop };
}
