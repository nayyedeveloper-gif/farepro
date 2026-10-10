export interface User {
  id: string;
  username: string;
  email?: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  contactId: string;
  user?: User;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: string;
  name?: string;
  avatarUrl?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participants?: User[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  messageType: string;
  fileUrl?: string;
  replyToId?: string;
  forwardedFrom?: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned?: boolean;
  createdAt: string;
  replyToMessage?: Message;
  forwardedUser?: User;
  updatedAt: string;
  sender?: User;
  status?: 'sent' | 'delivered' | 'seen';
}

export interface Call {
  id: string;
  conversationId: string;
  initiatedBy: string;
  callType: string;
  livekitRoomName: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  participants?: CallParticipant[];
  initiator?: User;
  livekitUrl?: string;
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface RegisterRequest {
  username: string;
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface CreateConversationRequest {
  type: string;
  name?: string;
  participantIds?: string[];
}

export interface SendMessageRequest {
  content?: string;
  messageType: string;
  fileUrl?: string;
  replyToId?: string;
}

export interface InitiateCallRequest {
  conversationId: string;
  callType: string;
}

export interface CallTokenRequest {
  roomName: string;
  identity?: string;
}

export interface CallHistoryItem {
  id: string;
  conversationId: string;
  initiatedBy: string;
  callType: string;
  status: string;
  callResult: string;
  startedAt: string;
  endedAt?: string;
  otherUserId: string;
  otherUsername?: string;
  otherFirstName?: string;
  otherLastName?: string;
  otherAvatarUrl?: string;
  otherPhone?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DialCallRequest {
  phone: string;
  callType: 'audio' | 'video';
}
