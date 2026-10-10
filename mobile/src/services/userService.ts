import { apiClient } from '../utils/apiClient';
import type { User } from '../types';

export const userService = {
  search: async (query: string): Promise<User[]> => {
    const response = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.put('/users/profile', data);
    return response.data;
  },

  getContacts: async (): Promise<User[]> => {
    const response = await apiClient.get('/users/contacts');
    return response.data;
  },

  addContact: async (contactId: string): Promise<void> => {
    await apiClient.post('/users/contacts', { contactId });
  },

  removeContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/contacts/${id}`);
  },
};
