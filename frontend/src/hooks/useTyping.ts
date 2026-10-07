import { useEffect } from 'react';
import { wsClient } from '@/lib/ws';
import { useTypingStore } from '@/store/typing';

export function useTyping() {
  const setTyping = useTypingStore((s) => s.setTyping);
  const clearExpired = useTypingStore((s) => s.clearExpired);

  useEffect(() => {
    const off = wsClient.on('typing', (evt: unknown) => {
      const event = evt as { conversation_id: number; user_id: number; is_typing: boolean };
      setTyping(event.conversation_id, event.user_id, event.is_typing);
    });
    return off;
  }, [setTyping]);

  useEffect(() => {
    const interval = setInterval(clearExpired, 1000);
    return () => clearInterval(interval);
  }, [clearExpired]);
}
