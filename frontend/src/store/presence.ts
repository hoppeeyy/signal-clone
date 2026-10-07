import { create } from 'zustand';

export interface PresenceState {
  is_online: boolean;
  last_seen: string | null;
}

interface PresenceStore {
  presences: Record<number, PresenceState>;
  setPresence: (userId: number, presence: PresenceState) => void;
  setPresences: (presences: Record<number, PresenceState>) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  presences: {},
  setPresence: (userId, presence) =>
    set((state) => ({ presences: { ...state.presences, [userId]: presence } })),
  setPresences: (presences) => set((state) => ({ presences: { ...state.presences, ...presences } })),
}));
