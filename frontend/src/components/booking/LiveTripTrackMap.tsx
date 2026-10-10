import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addTileLayer, fitToLatLngs, setupMapResizeObserver } from '../../utils/leafletMap';

interface LiveTripTrackMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
}

function pin(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'cb-map-marker',
    html: `<div class="cb-map-pin" style="--pin:${color}"><span>${label}</span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

const LiveTripTrackMap: React.FC<LiveTripTrackMapProps> = ({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  driverLat,
  driverLng,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupRef = useRef<L.Marker | null>(null);
  const dropoffRef = useRef<L.Marker | null>(null);
  const driverRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [16.8661, 96.1951],
      zoom: 13,
      zoomControl: false,
    });
    addTileLayer(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    const cleanup = setupMapResizeObserver(map, containerRef.current);
    return () => {
      cleanup();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setMarker = (
      ref: React.MutableRefObject<L.Marker | null>,
      lat?: number | null,
      lng?: number | null,
      color?: string,
      label?: string,
    ) => {
      if (lat == null || lng == null) {
        ref.current?.remove();
        ref.current = null;
        return;
      }
      if (!ref.current) {
        ref.current = L.marker([lat, lng], { icon: pin(color || '#1f8f6a', label || '') }).addTo(map);
      } else {
        ref.current.setLatLng([lat, lng]);
      }
    };

    setMarker(pickupRef, pickupLat, pickupLng, '#2563eb', 'A');
    setMarker(dropoffRef, dropoffLat, dropoffLng, '#dc2626', 'B');
    setMarker(driverRef, driverLat, driverLng, '#1f8f6a', 'D');

    const points: [number, number][] = [];
    if (pickupLat != null && pickupLng != null) points.push([pickupLat, pickupLng]);
    if (dropoffLat != null && dropoffLng != null) points.push([dropoffLat, dropoffLng]);
    if (driverLat != null && driverLng != null) points.push([driverLat, driverLng]);
    if (points.length > 0) fitToLatLngs(map, points);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, driverLat, driverLng]);

  const hasDriver = driverLat != null && driverLng != null;

  return (
    <div className="cb-live-map-wrap">
      <div ref={containerRef} className="cb-live-map" />
      <p className="cb-live-map-caption">
        {hasDriver ? 'ယာဉ်မောင်း တည်နေရာ (live)' : 'ယာဉ်မောင်း တည်နေရာ မရသေးပါ — assign ပြီး GPS ပို့မှ ပြပါမည်'}
      </p>
    </div>
  );
};

export default LiveTripTrackMap;
