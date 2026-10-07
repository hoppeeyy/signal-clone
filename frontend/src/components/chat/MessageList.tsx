import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { useMessages } from '@/store/messages';
import { useAuthStore } from '@/store/auth';
import { MessageBubble } from './MessageBubble';
import { DaySeparator } from './DaySeparator';
import { TypingBubble } from './TypingBubble';
import { Conversation } from '@/lib/types';
import { useTypingStore } from '@/store/typing';
import { SafetyNumberModal } from './SafetyNumberModal';

interface MessageListProps {
  conversation: Conversation;
  onReply: (message: import('@/lib/types').Message) => void;
}

export const MessageList = ({ conversation, onReply }: MessageListProps) => {
  const { messages, loading, hasMore, fetchMessages, initialized } = useMessages(conversation.id);
  const currentUser = useAuthStore(s => s.user);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // If scrolled up and new msgs arrive
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  
  const [initialUnreadCount, setInitialUnreadCount] = useState(conversation.unread_count);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialUnreadCount(conversation.unread_count);
  }, [conversation.id, conversation.unread_count]);

  // To preserve scroll position when loading more
  const previousScrollHeight = useRef<number>(0);
  const isFetchingMore = useRef(false);
  const isAutoScrolling = useRef(false);

  const typingUsersMap = useTypingStore(s => s.typingUsers[conversation.id]);
  const typingUserIds = Object.keys(typingUsersMap || {}).map(Number);
  const typingNames = typingUserIds.map(
    uid => conversation.members?.find(m => m.user_id === uid)?.user_display_name || 'Someone'
  );

  // Initial fetch
  useEffect(() => {
    if (!initialized) {
      fetchMessages();
    }
  }, [conversation.id, initialized, fetchMessages]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      isAutoScrolling.current = true;
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setUnreadCount(0);
      setShowScrollBottom(false);
    }
  }, []);

  // Initial scroll to bottom
  useLayoutEffect(() => {
    if (initialized && messages.length > 0 && !isFetchingMore.current && !showScrollBottom) {
      scrollToBottom(false);
    }
  }, [initialized, messages.length, scrollToBottom, showScrollBottom]);

  // Maintain scroll position when older messages load
  useLayoutEffect(() => {
    if (isFetchingMore.current && scrollRef.current) {
      const currentScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += currentScrollHeight - previousScrollHeight.current;
      isFetchingMore.current = false;
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isAutoScrolling.current) {
      // Allow auto scroll to finish
      if (Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight) < 10) {
        isAutoScrolling.current = false;
      }
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Load more when reaching top
    if (scrollTop < 100 && hasMore && !loading && !isFetchingMore.current) {
      isFetchingMore.current = true;
      previousScrollHeight.current = scrollHeight;
      const firstMsgId = messages[0]?.id;
      if (firstMsgId) {
        fetchMessages(firstMsgId);
      }
    }

    // Toggle scroll bottom button
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isAtBottom) {
      setShowScrollBottom(false);
      setUnreadCount(0);
    } else {
      setShowScrollBottom(true);
    }
  };

  // Group messages
  const groupedElements: React.ReactNode[] = [];
  
  if (!hasMore && !loading && initialized) {
    groupedElements.push(
      <div key="e2e-note" className="w-full flex justify-center my-6 px-4">
        <div className="bg-theme-row-hover rounded-[12px] p-4 text-center max-w-sm border border-theme-divider">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-theme-border flex items-center justify-center text-theme-text">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-theme-text-secondary mb-2">
            Messages and calls are end-to-end encrypted. No one outside of this chat, not even Signal, can read or listen to them.
          </p>
          {conversation.type === 'direct' && (
            <button 
              onClick={() => setSafetyModalOpen(true)}
              className="text-xs font-semibold text-theme-primary hover:underline"
            >
              Verify safety number
            </button>
          )}
        </div>
      </div>
    );
  }

  let lastDateStr = '';
  let unreadDividerInserted = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== lastDateStr) {
      groupedElements.push(<DaySeparator key={`day-${dateStr}`} date={new Date(msg.created_at)} />);
      lastDateStr = dateStr;
    }

    if (initialUnreadCount > 0 && !unreadDividerInserted && i === messages.length - initialUnreadCount) {
      unreadDividerInserted = true;
      groupedElements.push(
        <div key="unread-divider" className="flex items-center justify-center my-4 relative">
          <div className="absolute inset-0 flex items-center px-4">
            <div className="w-full border-t border-theme-primary opacity-30"></div>
          </div>
          <span className="relative bg-theme-app px-2 text-[12px] font-medium text-theme-primary uppercase tracking-wide">
            Unread messages
          </span>
        </div>
      );
    }

    const isOwn = msg.sender_id === currentUser?.id;
    const isGroup = conversation.type === 'group';

    if (msg.message_type === 'system') {
      groupedElements.push(
        <div key={msg.id} className="w-full flex justify-center my-2">
          <span className="text-[12px] font-medium text-theme-text-secondary text-center px-4">
            {msg.body}
          </span>
        </div>
      );
      continue;
    }
    
    let prevMsg = null;
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].message_type !== 'system') {
        prevMsg = messages[j];
        break;
      }
    }
    
    let nextMsg = null;
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].message_type !== 'system') {
        nextMsg = messages[j];
        break;
      }
    }

    const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || new Date(prevMsg.created_at).toDateString() !== dateStr;
    const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || new Date(nextMsg.created_at).toDateString() !== dateStr;
    const showSenderName = isGroup && !isOwn && isFirstInGroup;

    groupedElements.push(
      <MessageBubble
        key={msg.id}
        message={msg}
        isOwn={isOwn}
        isGroup={isGroup}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
        showSenderName={showSenderName}
        onReply={onReply}
      />
    );
  }

  return (
    <div className="flex-1 relative bg-theme-app overflow-hidden flex flex-col">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pt-4 pb-2 relative"
      >
        {loading && !messages.length && (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" />
          </div>
        )}
        
        {loading && messages.length > 0 && (
          <div className="flex justify-center p-2 absolute top-0 left-0 right-0 z-10">
            <div className="w-5 h-5 rounded-full border-2 border-theme-primary border-t-transparent animate-spin bg-white/50 backdrop-blur-sm" />
          </div>
        )}

        {groupedElements}
        
        {typingNames.length > 0 && (
          <TypingBubble names={typingNames} />
        )}
      </div>

      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-theme-app border border-theme-divider flex items-center justify-center text-theme-text-secondary shadow-md hover:bg-theme-border/50 transition-colors z-20"
        >
          <ChevronDown className="w-5 h-5" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-theme-primary text-white text-[11px] font-bold flex items-center justify-center px-1">
              {unreadCount}
            </div>
          )}
        </button>
      )}

      {safetyModalOpen && (
        <SafetyNumberModal 
          isOpen={safetyModalOpen}
          onClose={() => setSafetyModalOpen(false)}
          conversationId={conversation.id}
        />
      )}
    </div>
  );
};
