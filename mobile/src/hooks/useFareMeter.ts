import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  calculateFare,
  haversineKm,
  type FareRates,
  DEFAULT_FARE_RATES,
} from '../utils/fareMeter';

export type MeterPoint = { lat: number; lng: number; at: number };

export type FareMeterState = {
  running: boolean;
  paused: boolean;
  distanceKm: number;
  fareMmk: number;
  elapsedSec: number;
  speedKmh: number;
  position: MeterPoint | null;
  path: MeterPoint[];
  error: string | null;
};

const MIN_MOVE_M = 5; // ignore GPS jitter under ~5m
const MAX_JUMP_KM = 0.8; // discard impossible GPS jumps

export function useFareMeter(rates: FareRates = DEFAULT_FARE_RATES) {
  const [state, setState] = useState<FareMeterState>({
    running: false,
    paused: false,
    distanceKm: 0,
    fareMmk: rates.minimumFare || DEFAULT_FARE_RATES.minimumFare,
    elapsedSec: 0,
    speedKmh: 0,
    position: null,
    path: [],
    error: null,
  });

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pausedAccumRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const lastPointRef = useRef<MeterPoint | null>(null);
  const distanceRef = useRef(0);
  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  const tickElapsed = useCallback(() => {
    if (!startedAtRef.current) return;
    const pauseExtra =
      pauseStartedRef.current != null ? Date.now() - pauseStartedRef.current : 0;
    const elapsed = Math.floor(
      (Date.now() - startedAtRef.current - pausedAccumRef.current - pauseExtra) / 1000,
    );
    setState(prev => ({
      ...prev,
      elapsedSec: Math.max(0, elapsed),
      fareMmk: calculateFare(distanceRef.current, new Date(), ratesRef.current),
    }));
  }, []);

  useEffect(() => {
    if (!state.running || state.paused) return;
    const id = setInterval(tickElapsed, 1000);
    return () => clearInterval(id);
  }, [state.running, state.paused, tickElapsed]);

  const stopWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const onLocation = useCallback((loc: Location.LocationObject) => {
    const point: MeterPoint = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      at: Date.now(),
    };
    const last = lastPointRef.current;
    let added = 0;
    let speed = loc.coords.speed != null && loc.coords.speed > 0
      ? loc.coords.speed * 3.6
      : 0;

    if (last) {
      const jump = haversineKm(last.lat, last.lng, point.lat, point.lng);
      const dt = Math.max(0.001, (point.at - last.at) / 1000);
      if (jump * 1000 >= MIN_MOVE_M && jump <= MAX_JUMP_KM) {
        added = jump;
        distanceRef.current += jump;
        if (!speed) speed = (jump / dt) * 3600;
      }
    }

    lastPointRef.current = point;
    const distanceKm = Math.round(distanceRef.current * 1000) / 1000;
    const fareMmk = calculateFare(distanceKm, new Date(), ratesRef.current);

    setState(prev => ({
      ...prev,
      distanceKm,
      fareMmk,
      speedKmh: Math.round(speed),
      position: point,
      path: added > 0 || prev.path.length === 0 ? [...prev.path, point] : prev.path,
      error: null,
    }));
  }, []);

  const startWatch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setState(prev => ({ ...prev, error: 'Location permission required for fare meter' }));
      return false;
    }
    stopWatch();
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      onLocation,
    );
    return true;
  }, [onLocation, stopWatch]);

  const start = useCallback(async () => {
    distanceRef.current = 0;
    lastPointRef.current = null;
    pausedAccumRef.current = 0;
    pauseStartedRef.current = null;
    startedAtRef.current = Date.now();
    const ok = await startWatch();
    if (!ok) return;
    setState({
      running: true,
      paused: false,
      distanceKm: 0,
      fareMmk: ratesRef.current.minimumFare || DEFAULT_FARE_RATES.minimumFare,
      elapsedSec: 0,
      speedKmh: 0,
      position: null,
      path: [],
      error: null,
    });
  }, [startWatch]);

  const pause = useCallback(() => {
    pauseStartedRef.current = Date.now();
    stopWatch();
    setState(prev => ({ ...prev, paused: true }));
  }, [stopWatch]);

  const resume = useCallback(async () => {
    if (pauseStartedRef.current != null) {
      pausedAccumRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    const ok = await startWatch();
    if (!ok) return;
    setState(prev => ({ ...prev, paused: false }));
  }, [startWatch]);

  const stop = useCallback(() => {
    stopWatch();
    if (pauseStartedRef.current != null) {
      pausedAccumRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    const fareMmk = calculateFare(distanceRef.current, new Date(), ratesRef.current);
    setState(prev => ({
      ...prev,
      running: false,
      paused: false,
      fareMmk,
      distanceKm: Math.round(distanceRef.current * 1000) / 1000,
    }));
  }, [stopWatch]);

  const reset = useCallback(() => {
    stopWatch();
    startedAtRef.current = null;
    pausedAccumRef.current = 0;
    pauseStartedRef.current = null;
    lastPointRef.current = null;
    distanceRef.current = 0;
    setState({
      running: false,
      paused: false,
      distanceKm: 0,
      fareMmk: ratesRef.current.minimumFare || DEFAULT_FARE_RATES.minimumFare,
      elapsedSec: 0,
      speedKmh: 0,
      position: null,
      path: [],
      error: null,
    });
  }, [stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  return { ...state, start, pause, resume, stop, reset };
}
