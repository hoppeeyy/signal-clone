import { create } from 'zustand';
import { Conversation } from '@/lib/types';
import { fetchApi } from '@/lib/api';

interface ChatsState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  fetchConversations: () => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: number) => void;
  markConversationRead: (id: number) => void;
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  conversations: [],
  loading: false,
  error: null,
  searchQuery: '',
  
  setSearchQuery: (q) => set({ searchQuery: q }),
  
  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const q = get().searchQuery;
      const endpoint = q ? `/conversations?q=${encodeURIComponent(q)}` : '/conversations';
      const data = await fetchApi<Conversation[]>(endpoint);
      set({ 
        conversations: data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()), 
        loading: false 
      });
    } catch (err: unknown) {
      set({ 
        error: err instanceof Error ? err.message : 'Failed to load conversations', 
        loading: false 
      });
    }
  },

  upsertConversation: (conversation) => {
    set((state) => {
      const exists = state.conversations.find((c) => c.id === conversation.id);
      let newConvos;
      if (exists) {
        newConvos = state.conversations.map((c) => c.id === conversation.id ? conversation : c);
      } else {
        newConvos = [conversation, ...state.conversations];
      }
      return {
        conversations: newConvos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      };
    });
  },

  removeConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    }));
  },

  markConversationRead: (id) => {
    set((state) => ({
      conversations: state.conversations.map((c) => 
        c.id === id ? { ...c, unread_count: 0 } : c
      )
    }));
  }
}));
