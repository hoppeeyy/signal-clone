import { memo } from 'react';
import Link from 'next/link';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Conversation } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/auth';
import { useTypingStore } from '@/store/typing';
import { usePresenceStore } from '@/store/presence';
import { cn } from '@/components/ui/Button';

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEEE');
  return format(date, 'MM/dd/yy');
};

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
}

export const ConversationItem = memo(({ conversation, isSelected }: ConversationItemProps) => {
  const currentUser = useAuthStore(s => s.user);
  
  const presences = usePresenceStore(s => s.presences);
  const typingUsersMap = useTypingStore(s => s.typingUsers[conversation.id]);
  const typingUserIds = Object.keys(typingUsersMap || {}).map(Number);
  const isSomeoneTyping = typingUserIds.length > 0;
  
  let title = 'Unknown';
  let avatarUrl: string | undefined;
  let initials = '?';
  let isOnline = false;

  if (conversation.type === 'group') {
    title = conversation.display_name || conversation.name || 'Group';
    initials = title.charAt(0).toUpperCase();
    avatarUrl = conversation.avatar_url || undefined;
  } else {
    // Direct chat
    if (conversation.display_name) {
      title = conversation.display_name;
      avatarUrl = conversation.avatar_url || undefined;
      initials = title.charAt(0).toUpperCase();
      // If we have display_name from list read, it also gave is_online
      isOnline = (conversation as Conversation & { is_online?: boolean }).is_online || false;
    } else {
      const otherUser = conversation.members?.find(m => m.user_id !== currentUser?.id);
      if (otherUser) {
        title = otherUser.user_display_name || 'Unknown';
        avatarUrl = otherUser.user_avatar_url || undefined;
        initials = title.charAt(0).toUpperCase();
        const presence = presences[otherUser.user_id];
        isOnline = presence ? presence.is_online : (otherUser.is_online || false);
      }
    }
  }

  const hasUnread = conversation.unread_count > 0;
  const lastMsg = conversation.last_message;

  let previewText = '';
  if (lastMsg) {
    if (lastMsg.message_type === 'system') {
      let parsed = lastMsg.body || '';
      if (parsed.includes('{user:')) {
        const matches = parsed.match(/\{user:(\d+)\}/g);
        if (matches) {
          matches.forEach(match => {
            const uid = parseInt(match.replace(/[^0-9]/g, ''));
            const member = conversation.members?.find(m => m.user_id === uid);
            let name = member?.user_display_name;
            if (uid === currentUser?.id) name = 'You';
            parsed = parsed.replace(match, name || `User ${uid}`);
          });
        }
      }
      previewText = parsed;
    } else if (lastMsg.sender_id === currentUser?.id) {
      previewText = `You: ${lastMsg.body || ''}`;
    } else {
      if (conversation.type === 'group') {
        const sender = conversation.members?.find(m => m.user_id === lastMsg.sender_id);
        const senderName = sender?.user_display_name || 'Sender';
        previewText = `${senderName}: ${lastMsg.body || ''}`;
      } else {
        previewText = lastMsg.body || '';
      }
    }
  }
  
  let typingText = '';
  if (isSomeoneTyping) {
    if (conversation.type === 'group' && typingUserIds.length === 1) {
      const typingUser = conversation.members?.find(m => m.user_id === typingUserIds[0]);
      typingText = `${typingUser?.user_display_name || 'Someone'} is typing...`;
    } else {
      typingText = 'typing...';
    }
  }

  const currentMember = conversation.members?.find(m => m.user_id === currentUser?.id);
  const isMuted = currentMember?.muted || false;

  return (
    <Link 
      href={`/chat/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 px-4 h-[72px] cursor-pointer transition-colors duration-150",
        isSelected ? "bg-theme-row-active" : "hover:bg-theme-row-hover"
      )}
    >
      <Avatar 
        src={avatarUrl} 
        initials={initials} 
        isOnline={conversation.type === 'direct' && isOnline} 
        size="lg"
      />
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn(
            "text-sm truncate",
            hasUnread ? "font-bold text-theme-text" : "font-semibold text-theme-text"
          )}>
            {title}
          </span>
          <span className={cn(
            "text-[12px] whitespace-nowrap ml-2 flex-shrink-0",
            hasUnread ? "font-bold text-theme-primary" : "text-theme-text-secondary"
          )}>
            {formatTime(conversation.updated_at)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          {isSomeoneTyping ? (
            <span className="text-[13px] truncate italic font-medium text-theme-primary">
              {typingText}
            </span>
          ) : (
            <span className={cn(
              "text-[13px] truncate",
              hasUnread ? "font-bold text-theme-text" : "text-theme-text-secondary"
            )}>
              {previewText}
            </span>
          )}
          {hasUnread && (
            <div className={cn(
              "ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center",
              isMuted ? "bg-theme-text-secondary" : "bg-theme-primary"
            )}>
              {conversation.unread_count}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});
ConversationItem.displayName = 'ConversationItem';
