import type { AxiosError } from 'axios';

export function getNetworkErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;

  if (!ax || typeof ax !== 'object') {
    return 'Something went wrong. Please try again.';
  }

  if (ax.code === 'ECONNABORTED' || ax.message?.includes('timeout')) {
    return 'Request timed out. Check your connection and try again.';
  }

  if (ax.message === 'Request failed with status code 401') {
    return 'Session expired. Please sign in again.';
  }

  if (!ax.response) {
    if (ax.message === 'Network Error') {
      return 'Cannot reach the server. Check your internet connection or API settings.';
    }
    return 'No network connection. Check Wi‑Fi or mobile data.';
  }

  const status = ax.response.status;
  const body = ax.response.data;
  const serverMsg = body?.message || body?.error;

  if (serverMsg) return serverMsg;

  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You don’t have permission for this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status >= 500) return 'Server error. Please try again later.';

  return `Request failed (${status}).`;
}

export function isNetworkError(err: unknown): boolean {
  const ax = err as AxiosError;
  return !ax?.response || ax.code === 'ECONNABORTED';
}
