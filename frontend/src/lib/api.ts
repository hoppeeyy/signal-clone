import { useAuthStore } from '@/store/auth';

import { create } from 'zustand';

export const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const useServerState = create<{
  isWaking: boolean;
  setWaking: (w: boolean) => void;
}>((set) => ({
  isWaking: false,
  setWaking: (w) => set({ isWaking: w }),
}));

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const { setWaking } = useServerState.getState();
  const slowTimer = setTimeout(() => setWaking(true), 4000);
  let retries = 3;

  try {
    while (true) {
      try {
        const response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
        });

        if (!response.ok) {
          if ([502, 503, 504].includes(response.status) && retries > 0) {
            retries--;
            setWaking(true);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          if (response.status === 401) {
            useAuthStore.getState().logout();
          }
          const errData = await response.json().catch(() => ({}));
          throw new ApiError(response.status, errData.detail || response.statusText);
        }

        return await response.json() as Promise<T>;
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err;
        if (retries > 0) {
          retries--;
          setWaking(true);
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        throw new Error('Network error. Failed to connect to server.');
      }
    }
  } finally {
    clearTimeout(slowTimer);
    setWaking(false);
  }
}
