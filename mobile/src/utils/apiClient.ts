import axios, { AxiosInstance, AxiosError } from 'axios';
import { storage } from './storage';
import { API_URL } from '../config/api';
import { getNetworkErrorMessage } from './networkError';

export type ApiError = AxiosError<{ error?: string; message?: string }> & {
  friendlyMessage?: string;
};

let onUnauthorized: (() => void) | null = null;

/** AuthContext registers this to clear session on 401 */
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function enrichError(error: AxiosError): ApiError {
  const e = error as ApiError;
  e.friendlyMessage = getNetworkErrorMessage(e);
  return e;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await storage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(enrichError(error as AxiosError))
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status;
        const suspended = status === 403 && error.response?.data?.code === 'account_suspended';
        if (status === 401 || suspended) {
          await storage.removeItem('token');
          onUnauthorized?.();
        }
        return Promise.reject(enrichError(error as AxiosError));
      }
    );
  }

  public get = (url: string, config?: any) => this.client.get(url, config);
  public post = (url: string, data?: any, config?: any) => this.client.post(url, data, config);
  public put = (url: string, data?: any, config?: any) => this.client.put(url, data, config);
  public patch = (url: string, data?: any, config?: any) => this.client.patch(url, data, config);
  public delete = (url: string, config?: any) => this.client.delete(url, config);
}

export const apiClient = new ApiClient();
