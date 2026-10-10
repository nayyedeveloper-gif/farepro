import { apiClient } from '../utils/apiClient';
import type { Call } from '../types';

export const callService = {
  initiateCall: async (conversationId: string, callType: 'audio' | 'video'): Promise<{ call: Call; roomName: string; livekitUrl: string; participants: any[] }> => {
    const response = await apiClient.post('/calls/initiate', { conversationId, callType });
    return response.data;
  },

  joinCall: async (callId: string): Promise<{ call: Call; roomName: string; livekitUrl: string }> => {
    const response = await apiClient.post(`/calls/${callId}/join`);
    return response.data;
  },

  leaveCall: async (callId: string): Promise<void> => {
    await apiClient.post(`/calls/${callId}/leave`);
  },

  endCall: async (callId: string, reason = 'ended'): Promise<void> => {
    await apiClient.post(`/calls/${callId}/end`, { reason });
  },

  getCallToken: async (roomName: string, identity: string): Promise<{ token: string; url: string }> => {
    const response = await apiClient.post('/calls/token', { roomName, identity });
    return response.data;
  },

  getCallHistory: async (): Promise<Call[]> => {
    const response = await apiClient.get('/calls/history');
    return response.data;
  },
};
