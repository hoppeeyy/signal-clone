import { create } from 'zustand';

interface TypingStore {
  typingUsers: Record<number, Record<number, number>>; // conv_id -> { user_id -> expiry_ms }
  setTyping: (convId: number, userId: number, isTyping: boolean) => void;
  clearExpired: () => void;
}

export const useTypingStore = create<TypingStore>((set) => ({
  typingUsers: {},
  setTyping: (convId, userId, isTyping) =>
    set((state) => {
      const convTyping = { ...(state.typingUsers[convId] || {}) };
      if (isTyping) {
        convTyping[userId] = Date.now() + 5000;
      } else {
        delete convTyping[userId];
      }
      return { typingUsers: { ...state.typingUsers, [convId]: convTyping } };
    }),
  clearExpired: () =>
    set((state) => {
      const now = Date.now();
      let changed = false;
      const next = { ...state.typingUsers };
      for (const convId in next) {
        const users = next[convId];
        const nextUsers = { ...users };
        let convChanged = false;
        for (const userId in nextUsers) {
          if (nextUsers[userId] < now) {
            delete nextUsers[userId];
            convChanged = true;
            changed = true;
          }
        }
        if (convChanged) {
          next[convId] = nextUsers;
        }
      }
      return changed ? { typingUsers: next } : state;
    }),
}));
