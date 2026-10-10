import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface PlaceResult {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
}

export const geocodeAPI = {
  search: (q: string) =>
    api.get<PlaceResult[]>('/geocode/search', { params: { q } }),
  reverse: (lat: number, lng: number) =>
    api.get<PlaceResult>('/geocode/reverse', { params: { lat, lng } }),
};
