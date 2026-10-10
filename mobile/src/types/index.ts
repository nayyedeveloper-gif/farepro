export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  bio?: string;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file';
  fileUrl?: string;
  duration?: number;
  replyToId?: string;
  isRead?: boolean;
  createdAt: string;
  sender?: User;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name?: string;
  avatarUrl?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Call {
  id: string;
  conversationId: string;
  initiatedBy: string;
  callType: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  livekitRoomName: string;
  startedAt: string;
  endedAt?: string;
  initiator?: User;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

export interface AuthResponse {
  user: User;
  token: string;
}
