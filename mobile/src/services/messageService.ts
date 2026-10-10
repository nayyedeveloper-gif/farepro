import { apiClient } from '../utils/apiClient';
import type { Message, Conversation } from '../types';

export const messageService = {
  createConversation: async (data: { participantIds: string[]; isGroup: boolean; name?: string }): Promise<Conversation> => {
    const payload = {
      type: data.isGroup ? 'group' : 'direct',
      name: data.name,
      participantIds: data.participantIds,
    };
    const response = await apiClient.post('/messages/conversations', payload);
    return response.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/messages/messages/${messageId}`);
  },

  updateMessage: async (messageId: string, content: string): Promise<Message> => {
    const response = await apiClient.put(`/messages/messages/${messageId}`, { content });
    return response.data;
  },

  pinMessage: async (messageId: string): Promise<void> => {
    await apiClient.post(`/messages/messages/${messageId}/pin`);
  },

  unpinMessage: async (messageId: string): Promise<void> => {
    await apiClient.post(`/messages/messages/${messageId}/unpin`);
  },

  getConversations: async (): Promise<Conversation[]> => {
    const response = await apiClient.get('/messages/conversations');
    return response.data;
  },

  getMessages: async (conversationId: string, limit = 50, before?: string): Promise<Message[]> => {
    const id = String(conversationId).trim();
    const params: Record<string,any> = { limit };
    if (before) params.before = before;
    const response = await apiClient.get(`/messages/conversations/${id}/messages`, { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  sendMessage: async (conversationId: string, data: {
    content: string;
    messageType: string;
    fileUrl?: string;
    duration?: number;
    replyToId?: string;
  }): Promise<Message> => {
    const response = await apiClient.post(`/messages/conversations/${conversationId}/messages`, data);
    return response.data;
  },

  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.post(`/messages/conversations/${conversationId}/read`);
  },
};
