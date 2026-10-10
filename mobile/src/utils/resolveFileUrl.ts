import { API_URL } from '../config/api';

const BASE_URL = API_URL.replace('/api', '');

/**
 * Resolve a file URL to an absolute URL that the device can fetch.
 * Handles relative paths, localhost URLs (dev), /uploads/→/files/ rewrites,
 * and production URLs.
 */
export function resolveFileUrl(fileUrl: string | undefined | null): string | undefined {
  if (!fileUrl) return undefined;

  let url = fileUrl;

  // Old backend used /uploads/ but route is /files/
  if (url.includes('/uploads/')) {
    url = url.replace('/uploads/', '/files/');
  }

  // Already correct absolute URL
  if (url.startsWith(BASE_URL)) return url;

  // Replace localhost with actual dev base URL
  if (url.startsWith('http://localhost:8080')) {
    url = url.replace('http://localhost:8080', BASE_URL);
    return url;
  }

  // Relative path → prepend base URL
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }

  // Other absolute URL (e.g. production CDN) — return as-is
  if (url.startsWith('http')) return url;

  return url;
}
