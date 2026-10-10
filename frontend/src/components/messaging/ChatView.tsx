import React, { useState, useEffect } from 'react';
import type { Conversation } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import CreateConversationModal from './CreateConversationModal';
import UserSearchModal from '../common/UserSearchModal';
import CallButton from '../calls/CallButton';
import CallsPanel from '../calls/CallsPanel';
import BusyCallModal from '../calls/BusyCallModal';
import ForwardModal from './ForwardModal';
import AddMembersModal from './AddMembersModal';
import EditConversationModal from './EditConversationModal';
import GroupInfo from './GroupInfo';
import {
  EditIcon,
  SearchIcon,
  PhoneIcon,
  MenuIcon,
  ContactsIcon,
  ChatsIcon,
  SettingsIcon,
  ChevronLeftIcon,
  UserPlusIcon,
  RadioIcon,
} from '../icons/Icons';
import type { User } from '../../types';
import { useSocket } from '../../contexts/SocketContext';
import ProfileScreen from '../profile/ProfileScreen';
import UserProfileView from '../profile/UserProfileView';
import ChatMenuModal from './ChatMenuModal';
import ContactsPanel from '../profile/ContactsPanel';
import { messageAPI } from '../../services/api';
import { useCall } from '../../contexts/CallContext';
import PTTPanel from '../ptt/PTTPanel';

type SidebarTab = 'chats' | 'calls' | 'contacts' | 'settings' | 'ptt';

interface ChatViewProps {
  startConversationWithUserId?: string;
  onStartConversationHandled?: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({
  startConversationWithUserId,
  onStartConversationHandled,
}) => {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const { initiateCall } = useCall();
  const { sessionCount } = useNotifications();
  const [activeTab, setActiveTab] = useState<SidebarTab>('chats');
  const [showProfile, setShowProfile] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | undefined>(startConversationWithUserId);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [replyToMessage, setReplyToMessage] = useState<any>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [initialConversationType, setInitialConversationType] = useState<'group' | 'channel' | undefined>(undefined);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showEditConversationModal, setShowEditConversationModal] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread'>('all');
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  useEffect(() => {
    if (startConversationWithUserId) {
      setPendingUserId(startConversationWithUserId);
      setShowCreateModal(true);
    }
  }, [startConversationWithUserId]);

  useEffect(() => {
    if (!selectedConversation) {
      setTypingUser(null);
      return;
    }
    const unsubStart = subscribe('typing.start', (data) => {
      const d = data as { conversationId: string; userName: string; userId: string };
      if (d.conversationId === selectedConversation.id && d.userId !== user?.id) {
        setTypingUser(d.userName);
      }
    });
    const unsubStop = subscribe('typing.stop', (data) => {
      const d = data as { conversationId: string; userId: string };
      if (d.conversationId === selectedConversation.id && d.userId !== user?.id) {
        setTypingUser(null);
      }
    });
    return () => { unsubStart(); unsubStop(); };
  }, [selectedConversation, subscribe, user?.id]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setActiveTab('chats');
    setMobileChatOpen(true);
  };

  const handleMessageSent = () => {
    setRefreshTrigger((p) => p + 1);
  };

  const handleConversationCreated = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowCreateModal(false);
    setMobileChatOpen(true);
    setRefreshTrigger((p) => p + 1);
    onStartConversationHandled?.();
  };

  const handleUserSelected = (selectedUser: User) => {
    setShowSearchModal(false);
    setPendingUserId(selectedUser.id);
    setShowCreateModal(true);
  };

  const handleCallHistorySelect = async (userId: string, conversationId: string) => {
    try {
      const res = await messageAPI.getConversations();
      const convs = Array.isArray(res.data) ? res.data : [];
      const found = convs.find((c: Conversation) => c.id === conversationId);
      if (found) {
        setSelectedConversation(found);
      } else {
        setSelectedConversation({
          id: conversationId,
          type: 'private',
          createdBy: user?.id || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setActiveTab('chats');
      setMobileChatOpen(true);
      void userId;
    } catch {
      setActiveTab('chats');
    }
  };

  const handleReply = (msg: any) => setReplyToMessage(msg);
  const handleForward = (msg: any) => { setForwardMessage(msg); setShowForwardModal(true); };
  const clearReply = () => setReplyToMessage(null);

  const handleConversationDeleted = () => {
    setSelectedConversation(null);
    setMobileChatOpen(false);
    setRefreshTrigger((p) => p + 1);
  };

  const handleSettingsClick = () => {
    setShowProfile(true);
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    if (conversation.participants?.length) {
      return conversation.participants
        .filter((p) => p.id !== user?.id)
        .map((p) => p.firstName || p.username)
        .join(', ') || 'Conversation';
    }
    return 'Conversation';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.avatarUrl) return conversation.avatarUrl;
    return conversation.participants?.find((p) => p.id !== user?.id)?.avatarUrl;
  };

  const getConversationStatus = (conversation: Conversation) => {
    const other = conversation.participants?.find((p) => p.id !== user?.id);
    if (!other) return 'online';
    if (other.isOnline) return 'online';
    return 'last seen recently';
  };

  const userInitial = (user?.firstName || user?.username || 'U').charAt(0).toUpperCase();
  const sidebarTitle = {
    chats: 'Chats',
    calls: 'Calls',
    contacts: 'Contacts',
    settings: 'Settings',
    ptt: 'Push to Talk',
  }[activeTab];

  const appClass = `teamlink-app${mobileChatOpen && selectedConversation ? ' chat-open' : ''}`;

  return (
    <div className={appClass}>
      <BusyCallModal />

      <div className="chat-sidebar">
        {activeTab !== 'ptt' && (
        <div className="sidebar-top">
          <button className="sidebar-profile-btn" title="Profile" onClick={() => setShowProfile(true)}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="sidebar-profile-avatar" />
            ) : (
              <span className="sidebar-profile-avatar placeholder">{userInitial}</span>
            )}
            {sessionCount > 1 && <span className="session-badge">{sessionCount}</span>}
          </button>
          <h2 className="sidebar-title">{sidebarTitle}</h2>
          <div className="sidebar-top-actions">
            {activeTab === 'chats' && (
              <button className="sidebar-icon-btn" onClick={() => setShowCreateModal(true)} title="New message">
                <EditIcon size={18} />
              </button>
            )}
            {activeTab === 'contacts' && (
              <button className="sidebar-icon-btn" onClick={() => setShowSearchModal(true)} title="Add contact">
                <UserPlusIcon size={18} />
              </button>
            )}
          </div>
        </div>
        )}

        {activeTab === 'chats' && (
          <>
            <div className="sidebar-search">
              <SearchIcon size={16} className="sidebar-search-icon" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search-input"
              />
            </div>
            <div className="chat-filter-tabs">
              <button
                type="button"
                className={`chat-filter-tab ${chatFilter === 'all' ? 'active' : ''}`}
                onClick={() => setChatFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`chat-filter-tab ${chatFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setChatFilter('unread')}
              >
                Unread
              </button>
            </div>
            <ConversationList
              onSelectConversation={handleSelectConversation}
              selectedConversationId={selectedConversation?.id || null}
              refreshTrigger={refreshTrigger}
              searchQuery={searchQuery}
              filterTab={chatFilter}
              onConversationDeleted={handleConversationDeleted}
            />
          </>
        )}

        {activeTab === 'calls' && (
          <CallsPanel onSelectUser={handleCallHistorySelect} />
        )}

        {activeTab === 'contacts' && (
          <div className="sidebar-contacts-embed">
            <ContactsPanel
              embedded
              onClose={() => setActiveTab('chats')}
              onSelectUser={(user) => {
                setViewingUser(user);
              }}
              onAddContact={() => setShowSearchModal(true)}
            />
          </div>
        )}

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => { setActiveTab('chats'); setMobileChatOpen(false); }}
          >
            <ChatsIcon size={22} />
            <span>Chats</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('contacts'); setMobileChatOpen(false); }}
          >
            <ContactsIcon size={22} />
            <span>Contacts</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'calls' ? 'active' : ''}`}
            onClick={() => { setActiveTab('calls'); setMobileChatOpen(false); }}
          >
            <PhoneIcon size={22} />
            <span>Calls</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'ptt' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ptt'); setMobileChatOpen(false); }}
          >
            <RadioIcon size={22} />
            <span>PTT</span>
          </button>
          <button
            className={`sidebar-nav-item ${showProfile ? 'active' : ''}`}
            onClick={handleSettingsClick}
          >
            <SettingsIcon size={22} />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-powered-by">
          FarePro — Kilo Taxi Radio
        </div>
      </div>

      <div className={`chat-main${activeTab === 'ptt' ? ' ptt-mode' : ''}`}>
        {activeTab === 'ptt' ? (
          <div className="chat-main-ptt">
            <PTTPanel embedded />
          </div>
        ) : selectedConversation && activeTab === 'chats' ? (
          <>
            <div className="chat-header">
              <button
                className="chat-back-btn"
                onClick={() => { setMobileChatOpen(false); setSelectedConversation(null); }}
                aria-label="Back to chats"
              >
                <ChevronLeftIcon size={22} />
              </button>
              <div
                className="chat-header-left"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (selectedConversation.type !== 'private') {
                    setShowEditConversationModal(true);
                    return;
                  }
                  const other = selectedConversation.participants?.find((p) => p.id !== user?.id);
                  if (other) setViewingUser(other as User);
                }}
              >
                <div className="chat-header-avatar">
                  {getConversationAvatar(selectedConversation) ? (
                    <img src={getConversationAvatar(selectedConversation)} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{getConversationName(selectedConversation).charAt(0)}</span>
                  )}
                </div>
                <div className="chat-header-info">
                  <h3>{getConversationName(selectedConversation)}</h3>
                  <span className={`chat-status ${typingUser ? 'typing' : ''}`}>
                    {typingUser ? `${typingUser} is typing...` : getConversationStatus(selectedConversation)}
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                <CallButton conversationId={selectedConversation.id} callType="audio" />
                <CallButton conversationId={selectedConversation.id} callType="video" />
                {(selectedConversation.type === 'group' || selectedConversation.type === 'channel') && (
                  <button className="chat-header-btn" title="Add Members" onClick={() => setShowAddMembersModal(true)}>
                    <UserPlusIcon size={18} />
                  </button>
                )}
                {(selectedConversation.type === 'group' || selectedConversation.type === 'channel') && (
                  <button className="chat-header-btn" title="Group Info" onClick={() => setShowGroupInfo(true)}>
                    <SettingsIcon size={18} />
                  </button>
                )}
                <button className="chat-header-btn" title="Search in chat">
                  <SearchIcon size={18} />
                </button>
                <button className="chat-header-btn" title="More options" onClick={() => setShowChatMenu(true)}>
                  <MenuIcon size={18} />
                </button>
              </div>
            </div>
            <MessageList
              conversationId={selectedConversation.id}
              onReply={handleReply}
              onForward={handleForward}
            />
            <MessageInput
              conversationId={selectedConversation.id}
              onMessageSent={handleMessageSent}
              replyToMessage={replyToMessage}
              onClearReply={clearReply}
              participants={selectedConversation.participants}
            />
          </>
        ) : (
          <div className="chat-placeholder">
            <>
              <div className="chat-placeholder-icon">
                {activeTab === 'calls' ? <PhoneIcon size={48} /> :
                 activeTab === 'settings' ? <SettingsIcon size={48} /> :
                 <ContactsIcon size={48} />}
              </div>
              <p>
                {activeTab === 'calls' ? 'Select a call or use the dial pad' :
                 activeTab === 'settings' ? 'Manage your profile and preferences' :
                 activeTab === 'contacts' ? 'Select a contact to start messaging' :
                 'Select a chat to start messaging'}
              </p>
              {activeTab === 'chats' && (
                <p className="hint">Choose a conversation from the list or start a new chat</p>
              )}
            </>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateConversationModal
          onClose={() => { setShowCreateModal(false); setPendingUserId(undefined); setInitialConversationType(undefined); onStartConversationHandled?.(); }}
          onConversationCreated={handleConversationCreated}
          initialUserId={pendingUserId}
          initialType={initialConversationType}
        />
      )}
      {showSearchModal && (
        <UserSearchModal onClose={() => setShowSearchModal(false)} onUserSelected={handleUserSelected} />
      )}
      {showProfile && <ProfileScreen onClose={() => setShowProfile(false)} />}
      {viewingUser && (
        <UserProfileView
          user={viewingUser}
          onClose={() => setViewingUser(null)}
          onMessage={async () => {
            try {
              const convsRes = await messageAPI.getConversations();
              const convs: Conversation[] = Array.isArray(convsRes.data)
                ? convsRes.data
                : convsRes.data.conversations || [];
              const existing = convs.find(
                (c) => c.type === 'private' && c.participants?.some((p) => p.id === viewingUser.id)
              );
              if (existing) {
                setSelectedConversation(existing);
                setActiveTab('chats');
                setMobileChatOpen(true);
              } else {
                const res = await messageAPI.createConversation({
                  type: 'private',
                  participantIds: [viewingUser.id],
                });
                setSelectedConversation(res.data.conversation || res.data);
                setActiveTab('chats');
                setMobileChatOpen(true);
              }
              setViewingUser(null);
            } catch (err) {
              console.error('Failed to open chat:', err);
            }
          }}
          onVoiceCall={() => {
            if (selectedConversation) {
              void initiateCall(selectedConversation.id, 'audio');
              setViewingUser(null);
            }
          }}
          onVideoCall={() => {
            if (selectedConversation) {
              void initiateCall(selectedConversation.id, 'video');
              setViewingUser(null);
            }
          }}
        />
      )}
      {showChatMenu && selectedConversation && (
        <ChatMenuModal
          conversation={selectedConversation}
          onClose={() => setShowChatMenu(false)}
          onDeleted={handleConversationDeleted}
        />
      )}
      {showForwardModal && forwardMessage && (
        <ForwardModal
          message={forwardMessage}
          onClose={() => { setShowForwardModal(false); setForwardMessage(null); }}
        />
      )}
      {showAddMembersModal && selectedConversation && (
        <AddMembersModal
          conversationId={selectedConversation.id}
          onClose={() => setShowAddMembersModal(false)}
          onMembersAdded={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}
      {showEditConversationModal && selectedConversation && (
        <EditConversationModal
          conversationId={selectedConversation.id}
          currentName={selectedConversation.name || ''}
          currentDescription={selectedConversation.description || ''}
          currentAvatarUrl={selectedConversation.avatarUrl}
          onClose={() => setShowEditConversationModal(false)}
          onConversationUpdated={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}
      {showGroupInfo && selectedConversation && (
        <GroupInfo
          conversation={selectedConversation}
          onClose={() => setShowGroupInfo(false)}
          onEditConversation={() => {
            setShowGroupInfo(false);
            setShowEditConversationModal(true);
          }}
          onAddMembers={() => {
            setShowGroupInfo(false);
            setShowAddMembersModal(true);
          }}
        />
      )}
    </div>
  );
};

export default ChatView;
