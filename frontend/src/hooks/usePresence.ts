import { useEffect } from 'react';
import { wsClient } from '@/lib/ws';
import { usePresenceStore } from '@/store/presence';

export function usePresence() {
  const setPresence = usePresenceStore((s) => s.setPresence);

  useEffect(() => {
    const off = wsClient.on('presence', (evt: unknown) => {
      const event = evt as { user_id: number; is_online: boolean; last_seen: string | null };
      setPresence(event.user_id, {
        is_online: event.is_online,
        last_seen: event.last_seen,
      });
    });
    return off;
  }, [setPresence]);
}
