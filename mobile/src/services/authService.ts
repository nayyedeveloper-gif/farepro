import { apiClient } from '../utils/apiClient';
import type { AuthResponse, User } from '../types';

export const authService = {
  login: async (phone: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', { phone, password });
    return response.data;
  },

  register: async (phone: string, password: string, username: string, firstName?: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', { phone, password, username, firstName });
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },
};
