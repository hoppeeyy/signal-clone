import { memo, useState, useRef, useEffect } from 'react';
import { Phone, Video, Search, MoreVertical, Info, BellOff, Bell, Archive, Trash2, Clock, MailOpen, Lock, ArrowLeft, UserPlus, UserCheck } from 'lucide-react';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Conversation } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/auth';
import { useTypingStore } from '@/store/typing';
import { usePresenceStore } from '@/store/presence';
import { useChatsStore } from '@/store/chats';
import { useToast } from '@/components/ui/Toast';
import { GroupInfoModal } from './GroupInfoModal';
import { fetchApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

const formatLastSeen = (dateStr: string | null) => {
  if (!dateStr) return 'last seen recently';
  const date = new Date(dateStr);
  if (isToday(date)) return `last seen today at ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `last seen yesterday at ${format(date, 'h:mm a')}`;
  if (differenceInDays(new Date(), date) < 7) return `last seen ${format(date, 'EEE')} at ${format(date, 'h:mm a')}`;
  return `last seen ${format(date, 'MM/dd/yy')}`;
};

interface ChatHeaderProps {
  conversation: Conversation;
}

export const ChatHeader = memo(({ conversation }: ChatHeaderProps) => {
  const currentUser = useAuthStore(s => s.user);
  const presences = usePresenceStore(s => s.presences);
  const typingUsersMap = useTypingStore(s => s.typingUsers[conversation.id]);
  const typingUserIds = Object.keys(typingUsersMap || {}).map(Number);
  const isTyping = typingUserIds.length > 0;
  
  const toast = useToast();
  const router = useRouter();

  let title = 'Unknown';
  let subtitle = '';
  let avatarUrl: string | undefined;
  let initials = '?';
  let isOnline = false;

  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSavedContact, setIsSavedContact] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const upsertConversation = useChatsStore(s => s.upsertConversation);

  // Check if other user is already a contact
  useEffect(() => {
    if (conversation.type === 'direct') {
      const otherUser = conversation.members?.find(m => m.user_id !== currentUser?.id);
      if (otherUser) {
        fetchApi<{ id: number; contact_user: { id: number } }[]>('/contacts').then(contacts => {
          setIsSavedContact(contacts.some(c => c.contact_user?.id === otherUser.user_id));
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMember = conversation.members?.find(m => m.user_id === currentUser?.id);
  const isMuted = currentMember?.muted || false;

  if (conversation.type === 'group') {
    title = conversation.display_name || conversation.name || 'Group';
    avatarUrl = conversation.avatar_url || undefined;
    
    if (isTyping) {
      const typers = typingUserIds.map(uid => {
        const member = conversation.members?.find(m => m.user_id === uid);
        return member?.user_display_name?.split(' ')[0] || 'Someone';
      });
      if (typers.length === 1) {
        subtitle = `${typers[0]} is typing...`;
      } else if (typers.length <= 3) {
        subtitle = `${typers.join(', ')} are typing...`;
      } else {
        subtitle = 'Several people are typing...';
      }
    } else {
      subtitle = `${conversation.members?.length || 0} members`;
    }
    initials = title.charAt(0).toUpperCase();
  } else {
    if (conversation.display_name) {
      title = conversation.display_name;
      avatarUrl = conversation.avatar_url || undefined;
      initials = title.charAt(0).toUpperCase();
      const otherUserId = conversation.members?.find(m => m.user_id !== currentUser?.id)?.user_id;
      isOnline = (conversation as { is_online?: boolean }).is_online || false;
      const lastSeen = (conversation as { last_seen?: string }).last_seen || null;
      
      if (otherUserId && presences[otherUserId]) {
        isOnline = presences[otherUserId].is_online;
        subtitle = isOnline ? 'online' : formatLastSeen(presences[otherUserId].last_seen);
      } else {
        subtitle = isOnline ? 'online' : formatLastSeen(lastSeen);
      }
    } else {
      const otherUser = conversation.members?.find(m => m.user_id !== currentUser?.id);
      if (otherUser) {
        title = otherUser.user_display_name || 'Unknown';
        avatarUrl = otherUser.user_avatar_url || undefined;
        initials = title.charAt(0).toUpperCase();
        
        const presence = presences[otherUser.user_id];
        isOnline = presence ? presence.is_online : (otherUser.is_online || false);
        const lastSeen = presence ? presence.last_seen : (otherUser.last_seen || null);
        
        subtitle = isOnline ? 'online' : formatLastSeen(lastSeen);
      }
    }
    if (isTyping) {
      subtitle = 'typing...';
    }
  }

  const handleCall = () => {
    toast('Coming soon', 'info');
  };
  
  const handleHeaderClick = () => {
    if (conversation.type === 'group') {
      setGroupInfoOpen(true);
    } else {
      toast('Contact info coming soon', 'info');
    }
    setDropdownOpen(false);
  };

  const handleToggleMute = async () => {
    try {
      setDropdownOpen(false);
      const newMuted = !isMuted;
      await fetchApi(`/conversations/${conversation.id}/mute`, {
        method: 'PATCH',
        body: JSON.stringify({ muted: newMuted })
      });
      toast(newMuted ? 'Chat muted' : 'Chat unmuted', 'success');
      
      const updatedMembers = (conversation.members || []).map(m => 
        m.user_id === currentUser?.id ? { ...m, muted: newMuted } : m
      );
      upsertConversation({ ...conversation, members: updatedMembers });
    } catch {
      toast('Failed to update mute settings', 'error');
    }
  };

  const handleSaveContact = async () => {
    setDropdownOpen(false);
    const otherUser = conversation.members?.find(m => m.user_id !== currentUser?.id);
    if (!otherUser) return;
    try {
      // Try phone/username — use user_id via a dedicated endpoint if available
      await fetchApi('/contacts', {
        method: 'POST',
        body: JSON.stringify({ identifier: String(otherUser.user_id), nickname: otherUser.user_display_name })
      });
      setIsSavedContact(true);
      toast('Contact saved', 'success');
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 409) {
        toast('Already in your contacts', 'info');
        setIsSavedContact(true);
      } else {
        toast('Failed to save contact', 'error');
      }
    }
  };

  return (
    <>
      <div className="h-16 border-b border-theme-divider flex items-center justify-between px-4 bg-theme-app flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/')} className="md:hidden mr-1 hover:bg-theme-row-hover p-1.5 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-theme-text-secondary" />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleHeaderClick}>
          <Avatar 
            src={avatarUrl} 
            initials={initials} 
          isOnline={conversation.type === 'direct' && isOnline} 
          size="md"
        />
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-semibold text-theme-text leading-tight">{title}</span>
            <Lock className="w-3 h-3 text-theme-text-secondary" />
          </div>
          <span className={`text-[12px] ${isOnline || (isTyping && conversation.type === 'direct') ? 'text-theme-online' : 'text-theme-text-secondary'}`}>
            {subtitle}
          </span>
        </div>
      </div>
      </div>
      
      <div className="flex items-center gap-2 text-theme-text-secondary">
        <button onClick={handleCall} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-theme-row-hover transition-colors">
          <Video className="w-5 h-5" />
        </button>
        <button onClick={handleCall} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-theme-row-hover transition-colors">
          <Phone className="w-5 h-5" />
        </button>
        <button onClick={() => toast('Search coming soon', 'info')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-theme-row-hover transition-colors">
          <Search className="w-5 h-5" />
        </button>
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-theme-row-hover transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          
            {dropdownOpen && (
            <div className="absolute top-12 right-0 w-56 bg-theme-app rounded-[12px] shadow-lg border border-theme-divider py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={handleHeaderClick}
                className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
              >
                <Info className="w-4 h-4 text-theme-text-secondary" /> View info
              </button>
              {conversation.type === 'direct' && (
                <button 
                  onClick={handleSaveContact}
                  className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
                >
                  {isSavedContact 
                    ? <UserCheck className="w-4 h-4 text-theme-primary" />
                    : <UserPlus className="w-4 h-4 text-theme-text-secondary" />
                  }
                  {isSavedContact ? 'Saved to contacts' : 'Save contact'}
                </button>
              )}
              <button 
                onClick={handleToggleMute}
                className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
              >
                {isMuted ? <Bell className="w-4 h-4 text-theme-text-secondary" /> : <BellOff className="w-4 h-4 text-theme-text-secondary" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button 
                onClick={() => { toast('Mark as unread coming soon', 'info'); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
              >
                <MailOpen className="w-4 h-4 text-theme-text-secondary" /> Mark as unread
              </button>
              <button 
                onClick={() => { toast('Disappearing messages coming soon', 'info'); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
              >
                <Clock className="w-4 h-4 text-theme-text-secondary" /> Disappearing messages
              </button>
              <div className="h-[1px] bg-theme-divider my-1" />
              <button 
                onClick={() => { toast('Archive coming soon', 'info'); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-theme-text hover:bg-theme-row-hover flex items-center gap-3"
              >
                <Archive className="w-4 h-4 text-theme-text-secondary" /> Archive chat
              </button>
              <button 
                onClick={() => { toast('Delete chat coming soon', 'info'); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-3"
              >
                <Trash2 className="w-4 h-4" /> Delete chat
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
      
      {groupInfoOpen && (
        <GroupInfoModal 
          isOpen={groupInfoOpen} 
          onClose={() => setGroupInfoOpen(false)} 
          conversation={conversation} 
        />
      )}
    </>
  );
});
ChatHeader.displayName = 'ChatHeader';
