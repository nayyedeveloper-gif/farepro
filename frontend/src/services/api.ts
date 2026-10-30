import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const suspended = error.response?.status === 403 && error.response?.data?.code === 'account_suspended';
    if ((error.response?.status === 401 || suspended) && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth-error', { detail: suspended ? 'suspended' : 401 }));
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  createQRSession: () => api.post('/auth/qr/create'),
  getQRStatus: (sessionId: string) => api.get(`/auth/qr/status/${sessionId}`),
  approveQRSession: (data: { sessionId: string; token: string }) => api.post('/auth/qr/approve', data),
  getDevices: (deviceId: string) => api.get(`/auth/devices?deviceId=${encodeURIComponent(deviceId)}`),
  terminateDevice: (clientId: string) => api.delete(`/auth/devices/${clientId}`),
  terminateOtherDevices: (deviceId: string) => api.delete(`/auth/devices/others?deviceId=${encodeURIComponent(deviceId)}`),
};

export const userAPI = {
  search: (query: string) => api.get(`/users/search?q=${query}`),
  getById: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: any) => api.put('/users/profile', data),
  updateAvatar: (data: any) => api.post('/users/avatar', data),
  addContact: (contactId: string) => api.post('/users/contacts', { contactId }),
  getContacts: () => api.get('/users/contacts'),
  removeContact: (id: string) => api.delete(`/users/contacts/${id}`),
  checkUsername: (username: string) => api.get(`/users/check-username?username=${username}`),
};

export const fileAPI = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const messageAPI = {
  createConversation: (data: any) => api.post('/messages/conversations', data),
  joinChannel: (channelId: string) => api.post('/messages/conversations/join', { channelId }),
  addMembers: (conversationId: string, userIds: string[]) => api.post('/messages/conversations/add-members', { conversationId, userIds }),
  updateConversation: (conversationId: string, data: any) => api.put(`/messages/conversations/${conversationId}`, data),
  deleteConversation: (conversationId: string, forEveryone = false) =>
    api.delete(`/messages/conversations/${conversationId}${forEveryone ? '?forEveryone=true' : ''}`),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId: string, limit?: number, before?: string) => {
    let url = `/messages/conversations/${conversationId}/messages`;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    if (params.toString()) url += `?${params.toString()}`;
    return api.get(url);
  },
  sendMessage: (conversationId: string, data: any) => 
    api.post(`/messages/conversations/${conversationId}/messages`, data),
  updateMessage: (messageId: string, data: any) => 
    api.put(`/messages/messages/${messageId}`, data),
  deleteMessage: (messageId: string) => 
    api.delete(`/messages/messages/${messageId}`),
  markAsRead: (conversationId: string, messageId: string) => 
    api.post(`/messages/conversations/${conversationId}/read`, { messageId }),
  pinMessage: (messageId: string) => 
    api.post(`/messages/${messageId}/pin`),
  unpinMessage: (messageId: string) => 
    api.post(`/messages/${messageId}/unpin`),
};

export const callAPI = {
  getConversationCalls: (conversationId: string) =>
    api.get(`/messages/conversations/${conversationId}/calls`),
  getToken: (data: any) => api.post('/calls/token', data),
  getHistory: (filter?: string) => api.get(`/calls/history${filter ? `?filter=${filter}` : ''}`),
  getSessions: () => api.get('/calls/sessions'),
  dial: (data: any) => api.post('/calls/dial', data),
  initiate: (data: any) => api.post('/calls/initiate', data),
  join: (callId: string) => api.post(`/calls/${callId}/join`),
  leave: (callId: string) => api.post(`/calls/${callId}/leave`),
  end: (callId: string, reason?: string) => api.post(`/calls/${callId}/end`, { reason }),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read'),
  subscribePush: (payload: { endpoint: string; p256dh: string; auth: string }) =>
    api.post('/notifications/push/subscribe', payload),
  unsubscribePush: (endpoint: string) =>
    api.post('/notifications/push/unsubscribe', { endpoint }),
};

export const orgAPI = {
  signup: (data: any) => api.post('/org/signup', data),
  getIndustryTemplates: () => api.get('/org/industry-templates'),
  login: (data: any, subdomain: string) => api.post(`/org/login?subdomain=${subdomain}`, data),
  checkSubdomain: (subdomain: string) => api.get(`/org/check-subdomain?subdomain=${subdomain}`),
  getOrg: () => api.get('/org'),
  getOrgContext: () => api.get('/org/context'),
  updateOrg: (data: any) => api.put('/org', data),
  getMembers: () => api.get('/org/members'),
  inviteDriver: (data: any) => api.post('/org/members/invite', data),
  updateMemberRole: (userId: string, role: string) =>
    api.patch(`/org/members/${userId}/role`, { role }),
  removeMember: (userId: string) => api.delete(`/org/members/${userId}`),
  getDrivers: () => api.get('/org/drivers'),
  getDriver: (userId: string) => api.get(`/org/drivers/${userId}`),
  updateDriverProfile: (userId: string, data: {
    vehiclePlate?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licenseNo?: string;
    nrc?: string;
    notes?: string;
  }) => api.put(`/org/drivers/${userId}/profile`, data),
  adjustDriverWallet: (userId: string, data: {
    amountMmk: number;
    entryType?: 'credit' | 'debit' | 'adjust';
    reason?: string;
  }) => api.post(`/org/drivers/${userId}/wallet/adjust`, data),
  getFleet: () => api.get('/org/fleet'),
  broadcast: (data: { message: string; channelId?: string }) => api.post('/org/broadcast', data),
  getGeofenceZones: () => api.get('/org/geofence/zones'),
  createGeofenceZone: (data: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    alertOn: 'enter' | 'exit' | 'both';
    channelId?: string;
    color?: string;
  }) => api.post('/org/geofence/zones', data),
  updateGeofenceZone: (id: string, data: Record<string, unknown>) => api.put(`/org/geofence/zones/${id}`, data),
  deleteGeofenceZone: (id: string) => api.delete(`/org/geofence/zones/${id}`),
  getGeofenceAlerts: (limit = 50) => api.get('/org/geofence/alerts', { params: { limit } }),
  getTrips: (params?: { status?: string; serviceType?: string }) =>
    api.get('/org/trips', { params: params || {} }),
  createTrip: (data: {
    customerName: string;
    pickupAddress: string;
    dropoffAddress: string;
    driverId?: string;
    notes?: string;
    customerPhone?: string;
    serviceType?: 'taxi' | 'delivery';
    vehicleType?: 'motorcycle' | 'bicycle' | 'car';
    parcelNotes?: string;
  }) => api.post('/org/trips', data),
  updateTrip: (id: string, data: Record<string, unknown>) => api.patch(`/org/trips/${id}`, data),
  assignTrip: (id: string, driverId: string) => api.post(`/org/trips/${id}/assign`, { driverId }),
  autoAssignTrip: (id: string) => api.post(`/org/trips/${id}/auto-assign`),
  acceptTrip: (id: string) => api.post(`/org/trips/${id}/accept`),
  rejectTrip: (id: string) => api.post(`/org/trips/${id}/reject`),
  cancelTrip: (id: string, reason?: string) => api.post(`/org/trips/${id}/cancel`, { reason: reason || '' }),
  getTripHistory: () => api.get('/org/trips/history'),
  getTripMessages: (id: string) => api.get(`/org/trips/${id}/messages`),
  sendTripMessage: (id: string, body: string) => api.post(`/org/trips/${id}/messages`, { body }),
  getTripCallToken: (id: string) => api.post(`/org/trips/${id}/call/token`),
  getShifts: (status = 'active') => api.get('/org/shifts', { params: { status } }),
  getMyShift: () => api.get('/org/shifts/mine'),
  clockIn: (data: { locationName: string; roleLabel?: string }) => api.post('/org/shifts/clock-in', data),
  clockOut: () => api.post('/org/shifts/clock-out'),
  getEnterpriseFeatures: () => api.get('/org/enterprise-features'),
  getFareSettings: () => api.get('/org/fare-settings'),
  updateFareSettings: (data: {
    fareRatePerKm?: number;
    fareMinimum?: number;
    fareNightMultiplier?: number;
    fareNightStart?: number;
    fareNightEnd?: number;
    bookingEnabled?: boolean;
    customerAppTitle?: string;
    autoDispatch?: boolean;
    driverCreditFloorMmk?: number;
    walletPaymentInfo?: string;
    demandCatalog?: Array<{ code: string; name: string; amountMmk: number }>;
  }) => api.put('/org/fare-settings', data),
  getTopupRequests: (status = '') => api.get('/org/wallet/topups', { params: status ? { status } : {} }),
  approveTopupRequest: (id: string, note = '') => api.post(`/org/wallet/topups/${id}/approve`, { note }),
  rejectTopupRequest: (id: string, note = '') => api.post(`/org/wallet/topups/${id}/reject`, { note }),
  getChannels: () => api.get('/org/channels'),
  createChannel: (data: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    memberIds?: string[];
  }) => api.post('/org/channels', data),
  updateChannel: (id: string, data: {
    name?: string;
    description?: string;
    isPrivate?: boolean;
  }) => api.patch(`/org/channels/${id}`, data),
  deleteChannel: (id: string) => api.delete(`/org/channels/${id}`),
  getChannelMembers: (id: string) => api.get(`/org/channels/${id}/members`),
  addChannelMember: (id: string, userId: string) =>
    api.post(`/org/channels/${id}/members`, { userId }),
  removeChannelMember: (id: string, userId: string) =>
    api.delete(`/org/channels/${id}/members/${userId}`),
  ensureDriverPttChannel: (userId: string) =>
    api.post(`/org/drivers/${userId}/ptt-channel`),
  getCustomers: (q?: string) =>
    api.get('/org/customers', { params: q ? { q } : undefined }),
  createCustomer: (data: { name: string; phone: string; notes?: string }) =>
    api.post('/org/customers', data),
  updateCustomer: (id: string, data: { name?: string; phone?: string; notes?: string }) =>
    api.patch(`/org/customers/${id}`, data),
  deleteCustomer: (id: string) => api.delete(`/org/customers/${id}`),
  getCustomerTrips: (id: string) => api.get(`/org/customers/${id}/trips`),
  getDailyReport: (date?: string) =>
    api.get('/org/reports/daily', { params: date ? { date } : undefined }),
  requestTranscription: (channelId: string, recordingId: string) =>
    api.post(`/channels/${channelId}/ptt-history/${recordingId}/transcribe`),
};

export const platformAPI = {
  stats: () => api.get('/platform/stats'),
  listOrgs: () => api.get('/platform/orgs'),
  updateOrg: (id: string, data: { plan: string; maxDrivers?: number; isActive?: boolean }) =>
    api.patch(`/platform/orgs/${id}`, data),
  topupOrg: (id: string, data: { amountMmk: number; reason?: string }) =>
    api.post(`/platform/orgs/${id}/topup`, data),
  orgBilling: (id: string) => api.get(`/platform/orgs/${id}/billing`),
  overview: () => api.get('/platform/overview'),
  getOrg: (id: string) => api.get(`/platform/orgs/${id}`),
  createOrg: (data: {
    name: string;
    subdomain: string;
    ownerName: string;
    ownerPhone: string;
    password: string;
    industry?: string;
    plan?: string;
    maxDrivers?: number;
  }) => api.post('/platform/orgs', data),
  adjustDriverWallet: (orgId: string, userId: string, data: { amountMmk: number; reason?: string }) =>
    api.post(`/platform/orgs/${orgId}/drivers/${userId}/wallet`, data),
  drivers: (params?: { orgId?: string; q?: string; online?: boolean }) =>
    api.get('/platform/drivers', { params }),
  trips: (params?: { orgId?: string; status?: string; limit?: number }) =>
    api.get('/platform/trips', { params }),
  liveMap: (params?: { orgId?: string }) => api.get('/platform/map', { params }),
  billing: () => api.get('/platform/billing'),
  admins: () => api.get('/platform/admins'),
  grantAdmin: (phone: string) => api.post('/platform/admins', { phone }),
  revokeAdmin: (userId: string) => api.delete(`/platform/admins/${userId}`),
  users: (params?: { q?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/platform/users', { params }),
  suspendUser: (userId: string, reason: string) => api.post(`/platform/users/${userId}/suspend`, { reason }),
  restoreUser: (userId: string) => api.post(`/platform/users/${userId}/restore`),
  resetUserPassword: (userId: string) => api.post(`/platform/users/${userId}/reset-password`),
  audit: (params?: { action?: string; targetType?: string; targetId?: string; q?: string; limit?: number }) =>
    api.get('/platform/audit', { params }),
  system: () => api.get('/platform/system'),
};

export default api;
