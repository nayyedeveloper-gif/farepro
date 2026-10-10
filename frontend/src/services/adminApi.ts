const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalCalls: number;
  totalFiles: number;
  storageUsed: string;
}

interface User {
  id: string;
  firstName: string;
  username: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  isOnline: boolean;
  isBanned: boolean;
  createdAt: string;
  lastSeen: string;
}

interface Group {
  id: string;
  name: string;
  type: 'group' | 'channel';
  memberCount: number;
  adminCount: number;
  createdAt: string;
  lastActivity: string;
  isPrivate: boolean;
}

interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedMessageId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
}

interface File {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
  downloadCount: number;
  fileUrl: string;
}

interface Call {
  id: string;
  conversationId: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: string;
  duration: number;
  startedAt: string;
  endedAt: string;
  callResult: string;
}

interface UserConversation {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  lastMessage: string;
  lastMessageTime: string;
  messageCount: number;
}

interface SystemSettings {
  appName: string;
  appVersion: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  maxGroupMembers: number;
  enableRegistration: boolean;
  enableFileUpload: boolean;
  enableCalls: boolean;
  maintenanceMode: boolean;
  storageLimit: number;
  rateLimitPerMinute: number;
}

class AdminApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/admin/dashboard/stats');
  }

  // User Management
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ users: User[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const endpoint = `/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ users: User[]; page: number; limit: number; total: number }>(endpoint);
  }

  async banUser(userId: string, action: 'ban' | 'unban'): Promise<{ message: string; userId: string }> {
    return this.request<{ message: string; userId: string }>(`/admin/users/${userId}/ban?action=${action}`, {
      method: 'POST',
    });
  }

  async getUserConversations(userId: string): Promise<UserConversation[]> {
    return this.request<UserConversation[]>(`/admin/users/${userId}/conversations`);
  }

  // Group Management
  async getGroups(params?: {
    page?: number;
    limit?: number;
    type?: 'all' | 'group' | 'channel';
  }): Promise<{ groups: Group[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.type) queryParams.append('type', params.type);

    const endpoint = `/admin/groups${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ groups: Group[]; page: number; limit: number; total: number }>(endpoint);
  }

  async deleteGroup(groupId: string): Promise<{ message: string; groupId: string }> {
    return this.request<{ message: string; groupId: string }>(`/admin/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  // Content Moderation
  async getReports(params?: {
    page?: number;
    limit?: number;
    status?: 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  }): Promise<{ reports: Report[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const endpoint = `/admin/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ reports: Report[]; page: number; limit: number; total: number }>(endpoint);
  }

  async moderateReport(reportId: string, action: 'delete' | 'dismiss' | 'block'): Promise<{
    message: string;
    reportId: string;
  }> {
    return this.request<{ message: string; reportId: string }>(`/admin/reports/${reportId}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
  }

  // File Management
  async getFiles(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: 'all' | 'image' | 'video' | 'audio' | 'document';
  }): Promise<{ files: File[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.type) queryParams.append('type', params.type);

    const endpoint = `/admin/files${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ files: File[]; page: number; limit: number; total: number }>(endpoint);
  }

  async deleteFile(fileId: string): Promise<{ message: string; fileId: string }> {
    return this.request<{ message: string; fileId: string }>(`/admin/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  // Call Management
  async getCalls(params?: {
    page?: number;
    limit?: number;
    type?: 'all' | 'audio' | 'video';
    status?: 'all' | 'completed' | 'missed' | 'ongoing';
  }): Promise<{ calls: Call[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.type) queryParams.append('type', params.type);
    if (params?.status) queryParams.append('status', params.status);

    const endpoint = `/admin/calls${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ calls: Call[]; page: number; limit: number; total: number }>(endpoint);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>('/admin/settings');
  }

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<{ message: string }> {
    return this.request<{ message: string }>('/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
  }

  // Ads Management
  async getAds(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ ads: any[]; page: number; limit: number; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const endpoint = `/admin/ads${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<{ ads: any[]; page: number; limit: number; total: number }>(endpoint);
  }

  async createAd(ad: any): Promise<{ message: string; adId: string }> {
    return this.request<{ message: string; adId: string }>('/admin/ads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ad),
    });
  }

  async updateAd(adId: string, ad: any): Promise<{ message: string; adId: string }> {
    return this.request<{ message: string; adId: string }>(`/admin/ads/${adId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ad),
    });
  }

  async deleteAd(adId: string): Promise<{ message: string; adId: string }> {
    return this.request<{ message: string; adId: string }>(`/admin/ads/${adId}`, {
      method: 'DELETE',
    });
  }

  async getAdAnalytics(): Promise<{ analytics: any[] }> {
    return this.request<{ analytics: any[] }>('/admin/ads/analytics');
  }

  async getActiveAds(): Promise<{ ads: any[] }> {
    return this.request<{ ads: any[] }>('/ads/active');
  }

  async trackAdImpression(adId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/ads/${adId}/impression`, {
      method: 'POST',
    });
  }

  async trackAdClick(adId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/ads/${adId}/click`, {
      method: 'POST',
    });
  }
}

export const adminApi = new AdminApiService();
