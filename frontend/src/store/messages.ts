import { create } from 'zustand';
import { Message } from '@/lib/types';
import { fetchApi } from '@/lib/api';

interface ConversationMessagesState {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  initialized: boolean;
}

interface MessagesStore {
  conversations: Record<number, ConversationMessagesState>;
  fetchMessages: (conversationId: number, cursor?: number) => Promise<void>;
  addMessage: (conversationId: number, message: Message) => void;
  updateMessage: (conversationId: number, messageId: number, updates: Partial<Message>) => void;
  replaceTemp: (conversationId: number, tempId: number, realMessage: Message) => void;
  prependMessages: (conversationId: number, messages: Message[]) => void;
  removeMessage: (conversationId: number, messageId: number) => void;
}

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  conversations: {},

  fetchMessages: async (conversationId: number, cursor?: number) => {
    const state = get().conversations[conversationId] || { messages: [], hasMore: true, loading: false, initialized: false };
    if (state.loading || !state.hasMore) return;

    set(prev => ({
      conversations: {
        ...prev.conversations,
        [conversationId]: { ...state, loading: true }
      }
    }));

    try {
      const url = cursor 
        ? `/conversations/${conversationId}/messages?limit=30&before_id=${cursor}`
        : `/conversations/${conversationId}/messages?limit=30`;
        
      const data = await fetchApi<Message[]>(url);
      
      set(prev => {
        const current = prev.conversations[conversationId];
        // Ensure no duplicates by ID
        const existingIds = new Set(current.messages.map(m => m.id));
        const newMessages = data.filter(m => !existingIds.has(m.id));
        
        // Sorting messages by id (or created_at) ascending to render top-to-bottom
        // Wait, the API usually returns newest first if paginating?
        // Let's assume API returns newest first descending, so we must reverse them to append at top?
        // Let's assume the API returns messages in descending order (newest first)
        // If we want the UI to be top-to-bottom (oldest to newest), we should reverse the fetched chunk,
        // and prepend them to the existing list.
        const sortedChunk = [...newMessages].sort((a, b) => a.id - b.id);

        return {
          conversations: {
            ...prev.conversations,
            [conversationId]: {
              messages: cursor ? [...sortedChunk, ...current.messages] : sortedChunk,
              hasMore: data.length === 30,
              loading: false,
              initialized: true
            }
          }
        };
      });
    } catch (err) {
      console.error(err);
      set(prev => ({
        conversations: {
          ...prev.conversations,
          [conversationId]: { ...prev.conversations[conversationId], loading: false }
        }
      }));
    }
  },

  addMessage: (conversationId, message) => {
    set(prev => {
      const current = prev.conversations[conversationId] || { messages: [], hasMore: true, loading: false, initialized: true };
      return {
        conversations: {
          ...prev.conversations,
          [conversationId]: {
            ...current,
            messages: [...current.messages, message]
          }
        }
      };
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    set(prev => {
      const current = prev.conversations[conversationId];
      if (!current) return prev;
      return {
        conversations: {
          ...prev.conversations,
          [conversationId]: {
            ...current,
            messages: current.messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
          }
        }
      };
    });
  },

  replaceTemp: (conversationId, tempId, realMessage) => {
    set(prev => {
      const current = prev.conversations[conversationId];
      if (!current) return prev;
      return {
        conversations: {
          ...prev.conversations,
          [conversationId]: {
            ...current,
            messages: current.messages.map(m => m.id === tempId ? realMessage : m)
          }
        }
      };
    });
  },

  prependMessages: (conversationId, messages) => {
    set(prev => {
      const current = prev.conversations[conversationId] || { messages: [], hasMore: true, loading: false, initialized: true };
      return {
        conversations: {
          ...prev.conversations,
          [conversationId]: {
            ...current,
            messages: [...messages, ...current.messages]
          }
        }
      };
    });
  },

  removeMessage: (conversationId, messageId) => {
    set(prev => {
      const current = prev.conversations[conversationId];
      if (!current) return prev;
      return {
        conversations: {
          ...prev.conversations,
          [conversationId]: {
            ...current,
            messages: current.messages.filter(m => m.id !== messageId)
          }
        }
      };
    });
  }
}));

export const useMessages = (conversationId: number) => {
  const store = useMessagesStore();
  const state = store.conversations[conversationId] || { messages: [], hasMore: true, loading: false, initialized: false };

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    loading: state.loading,
    initialized: state.initialized,
    fetchMessages: (cursor?: number) => store.fetchMessages(conversationId, cursor),
    addMessage: (message: Message) => store.addMessage(conversationId, message),
    updateMessage: (messageId: number, updates: Partial<Message>) => store.updateMessage(conversationId, messageId, updates),
    replaceTemp: (tempId: number, realMessage: Message) => store.replaceTemp(conversationId, tempId, realMessage),
    removeMessage: (messageId: number) => store.removeMessage(conversationId, messageId)
  };
};
