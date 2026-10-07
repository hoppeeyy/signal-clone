import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useWsStore } from '@/store/ws';
import { wsClient } from '@/lib/ws';
import { fetchApi } from '@/lib/api';
import { useMessagesStore } from '@/store/messages';
import { useChatsStore } from '@/store/chats';
import { useToast } from '@/components/ui/Toast';
import { Message, Conversation } from '@/lib/types';
import { usePresence } from './usePresence';
import { useTyping } from './useTyping';
import { useReactions } from './useReactions';

export function useRealtime() {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const status = useWsStore((s) => s.status);
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const addMessage = useMessagesStore((s) => s.addMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const replaceTemp = useMessagesStore((s) => s.replaceTemp);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);

  usePresence();
  useTyping();
  useReactions();

  const conversations = useChatsStore((s) => s.conversations);
  const upsertConversation = useChatsStore((s) => s.upsertConversation);
  const fetchConversations = useChatsStore((s) => s.fetchConversations);
  const markConversationRead = useChatsStore((s) => s.markConversationRead);

  const activeConversationId = pathname.startsWith('/chat/')
    ? Number(pathname.replace('/chat/', ''))
    : null;

  const activeConvRef = useRef(activeConversationId);
  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  const isFocusedRef = useRef(typeof window !== 'undefined' ? document.hasFocus() : true);

  useEffect(() => {
    const onFocus = () => {
      isFocusedRef.current = true;
    };
    const onBlur = () => {
      isFocusedRef.current = false;
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (token) {
      wsClient.connect();
    } else {
      wsClient.disconnect();
    }
  }, [token]);

  const prevStatusRef = useRef(status);
  const initialMountRef = useRef(true);
  
  useEffect(() => {
    if (prevStatusRef.current === 'connecting' && status === 'open') {
      if (!initialMountRef.current) {
        toast('Connected', 'success');
      }
      initialMountRef.current = false;
      fetchConversations();
      if (activeConvRef.current) {
        fetchMessages(activeConvRef.current);
      }
    }
    prevStatusRef.current = status;
  }, [status, fetchConversations, fetchMessages, toast]);

  useEffect(() => {
    const offNewMessage = wsClient.on('new_message', (evt: unknown) => {
      const event = evt as { message: Message };
      const msg = event.message;
      if (msg.sender_id === currentUser?.id) return;

      const convId = msg.conversation_id;
      const isActive = activeConvRef.current === convId && isFocusedRef.current;

      addMessage(convId, msg);

      const conv = useChatsStore.getState().conversations.find((c) => c.id === convId);

      if (isActive) {
        wsClient.send({ type: 'mark_read', conversation_id: convId });
        if (conv) {
          upsertConversation({
            ...conv,
            last_message: msg,
            updated_at: msg.created_at,
            unread_count: 0,
          });
        }
        const currentMember = conv?.members?.find((m) => m.user_id === currentUser?.id);
        const isMuted = currentMember?.muted || false;

        if (!isMuted) {
          const senderName = msg.sender_summary?.display_name || 'Unknown';
          let preview = msg.body || (msg.attachments?.length ? 'Sent an attachment' : '');
          if (preview.length > 20) {
            preview = preview.substring(0, 20) + '...';
          }
          toast(`${senderName}: ${preview}`, 'info', 'View', () => {
            router.push(`/chat/${convId}`);
          });
        }

        if (conv) {
          upsertConversation({
            ...conv,
            last_message: msg,
            updated_at: msg.created_at,
            unread_count: conv.unread_count + 1,
          });
        } else {
          fetchConversations();
        }

        const unreadConvs = useChatsStore.getState().conversations.reduce((sum, c) => sum + c.unread_count, 1);
        document.title = `Signal Clone (${unreadConvs})`;
      }
    });

    const offMessageAck = wsClient.on('message_ack', (evt: unknown) => {
      const event = evt as { client_temp_id: number; message: Message };
      const { client_temp_id, message } = event;
      replaceTemp(message.conversation_id, client_temp_id, message);
      const conv = useChatsStore.getState().conversations.find((c) => c.id === message.conversation_id);
      if (conv) {
        upsertConversation({
          ...conv,
          last_message: message,
          updated_at: message.created_at,
        });
      }
    });

    const offMessageStatus = wsClient.on('message_status', (evt: unknown) => {
      const event = evt as { message_id: number; conversation_id: number; status: Message['status'] };
      const { message_id, conversation_id, status: newStatus } = event;
      const storeState = useMessagesStore.getState().conversations[conversation_id];
      const existing = storeState?.messages.find((m) => m.id === message_id);
      if (existing) {
        const statuses = ['sending', 'failed', 'sent', 'delivered', 'read'];
        const oldIndex = statuses.indexOf(existing.status);
        const newIndex = statuses.indexOf(newStatus);
        if (newIndex > oldIndex) {
          updateMessage(conversation_id, message_id, { status: newStatus });
        }
      }
    });

    const offConversationUpdated = wsClient.on('conversation_updated', async (evt: unknown) => {
      const event = evt as { conversation_id: number };
      try {
        const conv = await fetchApi<Conversation>(`/conversations/${event.conversation_id}`);
        upsertConversation(conv);
      } catch (err) {
        const error = err as { status?: number };
        if (error.status === 404 || error.status === 403) {
          // Keep it in store, but we can't fetch it anymore. We'll rely on member_removed event.
        }
      }
    });

    const offGroupMemberAdded = wsClient.on('group.member_added', async (evt: unknown) => {
      const event = evt as { conversation_id: number };
      try {
        const conv = await fetchApi<Conversation>(`/conversations/${event.conversation_id}`);
        upsertConversation(conv);
      } catch (e) {
        // Ignore
      }
    });

    const offGroupMemberRemoved = wsClient.on('group.member_removed', (evt: unknown) => {
      const event = evt as { conversation_id: number, removed_user_id: number };
      const conv = useChatsStore.getState().conversations.find((c) => c.id === event.conversation_id);
      if (conv) {
        const newMembers = conv.members?.filter(m => m.user_id !== event.removed_user_id) || [];
        upsertConversation({
          ...conv,
          members: newMembers,
        });

        if (event.removed_user_id === currentUser?.id) {
          toast('You were removed from this group', 'info');
          // Don't redirect, let them see history
        }
      }
    });

    const offMessageDeleted = wsClient.on('message.deleted', (evt: unknown) => {
      const event = evt as { message_id: number; conversation_id: number };
      const conv = useMessagesStore.getState().conversations[event.conversation_id];
      if (conv) {
        const msg = conv.messages.find((m) => m.id === event.message_id);
        if (msg) {
          updateMessage(event.conversation_id, event.message_id, { body: null, deleted: true });
        }
      }
    });

    return () => {
      offNewMessage();
      offMessageAck();
      offMessageStatus();
      offConversationUpdated();
      offGroupMemberAdded();
      offGroupMemberRemoved();
      offMessageDeleted();
    };
  }, [currentUser?.id, addMessage, replaceTemp, updateMessage, upsertConversation, fetchConversations, toast, router]);

  useEffect(() => {
    const handleFocus = () => {
      if (activeConversationId) {
        const conv = conversations.find((c) => c.id === activeConversationId);
        if (conv && conv.unread_count > 0) {
          wsClient.send({ type: 'mark_read', conversation_id: activeConversationId });
          markConversationRead(activeConversationId);
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    handleFocus();

    return () => window.removeEventListener('focus', handleFocus);
  }, [activeConversationId, conversations, markConversationRead]);
}
