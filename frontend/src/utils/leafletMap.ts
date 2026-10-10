import L from 'leaflet';

export const MAP_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const FALLBACK_CENTER: [number, number] = [16.8661, 96.1951];

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    });
  });
}

export async function getMapCenter(): Promise<[number, number]> {
  try {
    const pos = await getCurrentPosition();
    return [pos.coords.latitude, pos.coords.longitude];
  } catch {
    return FALLBACK_CENTER;
  }
}

export function createMyLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-my-location-marker',
    html: '<div class="map-my-location-pulse"><div class="map-my-location-dot"></div></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function addTileLayer(map: L.Map) {
  L.tileLayer(MAP_TILE, {
    maxZoom: 19,
    subdomains: 'abc',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

export function fitToLatLngs(map: L.Map, points: [number, number][], maxZoom = 15) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView(points[0], maxZoom);
    return;
  }
  map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom });
}

export function setupMapResizeObserver(
  map: L.Map,
  container: HTMLElement,
): () => void {
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(container);
  setTimeout(() => map.invalidateSize(), 100);
  return () => ro.disconnect();
}

export function updateMyLocationMarker(
  map: L.Map,
  markerRef: { current: L.Marker | null },
  lat: number,
  lng: number,
) {
  const pos: [number, number] = [lat, lng];
  if (markerRef.current) {
    markerRef.current.setLatLng(pos);
  } else {
    const marker = L.marker(pos, { icon: createMyLocationIcon(), zIndexOffset: 1000 });
    marker.bindPopup('<b>You are here</b>');
    marker.addTo(map);
    markerRef.current = marker;
  }
}
