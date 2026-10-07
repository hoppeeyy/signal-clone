'use client';

import { useEffect, useState } from 'react';
import { useChatsStore } from '@/store/chats';
import { fetchApi } from '@/lib/api';
import { Conversation, Message } from '@/lib/types';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { Composer } from '@/components/chat/Composer';
import { useAuthStore } from '@/store/auth';

export const ChatPane = ({ id }: { id: number }) => {
  const conversations = useChatsStore(s => s.conversations);
  const upsertConversation = useChatsStore(s => s.upsertConversation);
  const currentUser = useAuthStore(s => s.user);
  
  const storeConv = conversations.find(c => c.id === id);
  const [conv, setConv] = useState<Conversation | null>(storeConv || null);
  const [prevStoreConv, setPrevStoreConv] = useState(storeConv);
  const [loading, setLoading] = useState(!storeConv);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  if (storeConv !== prevStoreConv) {
    setPrevStoreConv(storeConv);
    if (storeConv) {
      setConv(storeConv);
    }
  }

  useEffect(() => {
    // If not in store, fetch it
    const loadConv = async () => {
      try {
        setLoading(true);
        // Wait, the backend doesn't have a GET /conversations/{id} by default, 
        // it has GET /conversations which lists them.
        // If it's not in the store, fetch all conversations.
        const data = await fetchApi<Conversation[]>('/conversations');
        data.forEach(c => upsertConversation(c));
        const found = data.find(c => c.id === id);
        if (found) {
          setConv(found);
        } else {
          setError('Conversation not found');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    if (!storeConv) {
      loadConv();
    }
  }, [id, storeConv, upsertConversation]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-theme-app">
        <h2 className="text-xl font-semibold text-theme-text mb-2">Error</h2>
        <p className="text-theme-text-secondary text-sm">{error}</p>
      </div>
    );
  }

  if (loading || !conv) {
    return (
      <div className="flex-1 flex items-center justify-center bg-theme-app">
        <div className="w-8 h-8 rounded-full border-4 border-theme-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isMember = conv.members?.some(m => m.user_id === currentUser?.id) ?? true;

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-app w-full">
      <ChatHeader conversation={conv} />
      <MessageList conversation={conv} onReply={setReplyingTo} />
      {isMember ? (
        <Composer conversation={conv} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
      ) : (
        <div className="p-4 flex items-center justify-center bg-theme-app border-t border-theme-divider">
          <span className="text-sm font-medium text-theme-text-secondary">
            You are no longer in this group
          </span>
        </div>
      )}
    </div>
  );
};
