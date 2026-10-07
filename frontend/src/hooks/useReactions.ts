import { useEffect } from 'react';
import { wsClient } from '@/lib/ws';
import { useMessagesStore } from '@/store/messages';

export function useReactions() {
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  useEffect(() => {
    const off = wsClient.on('reaction.updated', (evt: unknown) => {
      const event = evt as { message_id: number; conversation_id: number; user_id: number, emoji: string | null, reactions_summary: import('@/lib/types').ReactionSummary[] };
      
      const conv = useMessagesStore.getState().conversations[event.conversation_id];
      if (conv) {
        const msg = conv.messages.find((m) => m.id === event.message_id);
        if (msg) {
          updateMessage(event.conversation_id, event.message_id, { reactions_grouped: event.reactions_summary });
        }
      }
    });
    return off;
  }, [updateMessage]);
}
