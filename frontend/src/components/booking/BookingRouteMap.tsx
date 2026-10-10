import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addTileLayer, fitToLatLngs, setupMapResizeObserver } from '../../utils/leafletMap';
import type { SelectedPlace } from './PlaceSearchInput';

interface BookingRouteMapProps {
  pickup: SelectedPlace | null;
  dropoff: SelectedPlace | null;
}

function markerIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'cb-map-marker',
    html: `<div class="cb-map-pin" style="--pin:${color}"><span>${label}</span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

export default function BookingRouteMap({ pickup, dropoff }: BookingRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupRef = useRef<L.Marker | null>(null);
  const dropoffRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

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

    const upsert = (
      ref: React.MutableRefObject<L.Marker | null>,
      place: SelectedPlace | null,
      color: string,
      label: string,
    ) => {
      if (!place) {
        ref.current?.remove();
        ref.current = null;
        return;
      }
      const pos: [number, number] = [place.lat, place.lng];
      if (ref.current) {
        ref.current.setLatLng(pos);
      } else {
        ref.current = L.marker(pos, { icon: markerIcon(color, label) }).addTo(map);
      }
    };

    upsert(pickupRef, pickup, '#22c55e', 'A');
    upsert(dropoffRef, dropoff, '#F26522', 'B');

    lineRef.current?.remove();
    lineRef.current = null;
    if (pickup && dropoff) {
      const pts: [number, number][] = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
      lineRef.current = L.polyline(pts, {
        color: '#F26522',
        weight: 4,
        opacity: 0.75,
        dashArray: '8 8',
      }).addTo(map);
      fitToLatLngs(map, pts, 14);
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14);
    }
  }, [pickup, dropoff]);

  return (
    <div className="cb-map-wrap">
      <div ref={containerRef} className="cb-map" aria-label="Route map" />
      {!pickup && !dropoff && (
        <div className="cb-map-overlay">နေရာ ရွေးပြီးပါက map ပေါ်မှာ ပြပါမည်</div>
      )}
    </div>
  );
}
