'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useChatsStore } from '@/store/chats';
import { ConversationItem } from './ConversationItem';
import { Button } from '@/components/ui/Button';

export const ConversationList = () => {
  const { conversations, loading, error, fetchConversations } = useChatsStore();
  const pathname = usePathname();
  
  const currentId = pathname.startsWith('/chat/') ? pathname.replace('/chat/', '') : null;

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-12 h-12 rounded-full bg-theme-border/50 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="h-4 w-24 bg-theme-border/50 rounded animate-pulse" />
                <div className="h-3 w-8 bg-theme-border/50 rounded animate-pulse" />
              </div>
              <div className="h-3 w-40 bg-theme-border/30 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-theme-text-secondary text-sm mb-4">{error}</p>
        <Button onClick={() => fetchConversations()} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-theme-text font-medium mb-1">No chats yet</p>
        <p className="text-theme-text-secondary text-sm mb-4">Start a new conversation to see it here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {conversations.map(conv => (
        <ConversationItem 
          key={conv.id} 
          conversation={conv} 
          isSelected={Number(currentId) === conv.id} 
        />
      ))}
    </div>
  );
};

