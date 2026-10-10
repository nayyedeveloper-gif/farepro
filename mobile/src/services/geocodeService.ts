import { apiClient } from '../utils/apiClient';

export interface PlaceResult {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
}

export const geocodeService = {
  search: async (q: string) => {
    const res = await apiClient.get('/geocode/search', { params: { q } });
    return { data: res.data as PlaceResult[] };
  },
  reverse: async (lat: number, lng: number) => {
    const res = await apiClient.get('/geocode/reverse', { params: { lat, lng } });
    return { data: res.data as PlaceResult };
  },
};
