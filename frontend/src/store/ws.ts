import { create } from 'zustand';

interface WsState {
  status: 'connecting' | 'open' | 'closed';
  setStatus: (status: 'connecting' | 'open' | 'closed') => void;
}

export const useWsStore = create<WsState>((set) => ({
  status: 'closed',
  setStatus: (status) => set({ status }),
}));
