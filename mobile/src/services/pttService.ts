import { apiClient } from '../utils/apiClient';
import type { PTTChannel, PTTMember } from '../types/ptt';

export const pttService = {
  // Channels
  listChannels: async (): Promise<PTTChannel[]> => {
    const res = await apiClient.get('/channels');
    return res.data;
  },

  getMyChannels: async (): Promise<PTTChannel[]> => {
    const res = await apiClient.get('/channels/mine');
    return res.data;
  },

  createChannel: async (name: string, description: string): Promise<PTTChannel> => {
    const res = await apiClient.post('/channels', { name, description });
    return res.data;
  },

  updateChannel: async (id: string, data: { name?: string; description?: string; avatarUrl?: string; isPrivate?: boolean }): Promise<PTTChannel> => {
    const res = await apiClient.patch(`/channels/${id}`, data);
    return res.data;
  },

  deleteChannel: async (id: string): Promise<void> => {
    await apiClient.delete(`/channels/${id}`);
  },

  joinChannel: async (id: string): Promise<void> => {
    await apiClient.post(`/channels/${id}/join`);
  },

  leaveChannel: async (id: string): Promise<void> => {
    await apiClient.post(`/channels/${id}/leave`);
  },

  // Members
  getMembers: async (channelId: string): Promise<PTTMember[]> => {
    const res = await apiClient.get(`/channels/${channelId}/members`);
    return (res.data as any[]).map(u => ({
      id: u.id,
      username: u.username || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      isOnline: !!u.isOnline,
      status: u.status || 'available',
      role: 'member' as const,
    }));
  },

  getMembersWithRoles: async (channelId: string): Promise<PTTMember[]> => {
    const res = await apiClient.get(`/channels/${channelId}/members/roles`);
    return (res.data as any[]).map(m => ({
      id: m.user?.id || m.userId,
      username: m.user?.username || '',
      firstName: m.user?.firstName || '',
      lastName: m.user?.lastName || '',
      isOnline: !!m.user?.isOnline,
      status: m.user?.status || 'available',
      role: m.role || 'member',
      joinedAt: m.joinedAt,
    }));
  },

  updateMemberRole: async (channelId: string, userId: string, role: 'admin' | 'member'): Promise<void> => {
    await apiClient.put(`/channels/${channelId}/members/${userId}/role`, { userId, role });
  },

  kickMember: async (channelId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/channels/${channelId}/members/${userId}`);
  },

  // Invite
  getInviteToken: async (channelId: string): Promise<string> => {
    const res = await apiClient.get(`/channels/${channelId}/invite`);
    return res.data.token;
  },

  joinByInvite: async (token: string): Promise<PTTChannel> => {
    const res = await apiClient.post(`/ptt/join/${token}`);
    return res.data;
  },

  // Status
  updateStatus: async (status: string): Promise<void> => {
    await apiClient.post('/ptt/status', { status });
  },

  // Emergency
  sendEmergency: async (channelId: string): Promise<void> => {
    await apiClient.post(`/channels/${channelId}/emergency`);
  },

  // Location
  getChannelLocations: async (channelId: string) => {
    const res = await apiClient.get(`/channels/${channelId}/locations`);
    return res.data;
  },

  updateLocation: async (
    channelId: string,
    data: { latitude: number; longitude: number; heading?: number; speed?: number; status?: string },
  ): Promise<void> => {
    await apiClient.put(`/channels/${channelId}/locations`, data);
  },

  clearLocation: async (channelId: string): Promise<void> => {
    await apiClient.delete(`/channels/${channelId}/locations`);
  },

  // File upload
  uploadFile: async (uri: string, mimeType: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: mimeType,
      name: 'upload.jpg',
    } as any);
    const res = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  },
};
