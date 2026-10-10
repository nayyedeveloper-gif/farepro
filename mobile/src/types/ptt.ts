export interface PTTChannel {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  isPrivate: boolean;
  createdBy: string;
  memberCount: number;
}

export interface PTTMember {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isOnline: boolean;
  status: string;
  role: 'admin' | 'member';
  joinedAt?: string;
}

export type UserStatus = 'available' | 'busy' | 'dnd';

export interface PTTTransmitState {
  isTransmitting: boolean;
  activeSpeakerId: string | null;
  activeSpeakerName: string | null;
  channelId: string | null;
}
