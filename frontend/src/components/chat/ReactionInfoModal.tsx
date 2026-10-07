'use client';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Message } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

interface ReactionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

interface ReactionWithUser {
  user_id: number;
  emoji: string;
  user_display_name: string;
  user_avatar_url?: string;
}

export const ReactionInfoModal = ({ isOpen, onClose, message }: ReactionInfoModalProps) => {
  const [reactions, setReactions] = useState<ReactionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      const loadReactions = async () => {
        try {
          setLoading(true);
          const data = await fetchApi<ReactionWithUser[]>(`/messages/${message.id}/reactions`);
          setReactions(data);
        } catch (err) {
          toast('Failed to load reactions', 'error');
        } finally {
          setLoading(false);
        }
      };
      loadReactions();
    }
  }, [isOpen, message.id, toast]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reactions">
      <div className="flex flex-col gap-2 mt-2 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" />
          </div>
        ) : reactions.length === 0 ? (
          <p className="text-sm text-theme-text-secondary text-center py-4">No reactions</p>
        ) : (
          <div className="flex flex-col gap-1">
            {reactions.map((r, i) => (
              <div key={`${r.user_id}-${i}`} className="flex items-center gap-3 p-2 hover:bg-theme-row-hover rounded transition-colors">
                <Avatar src={r.user_avatar_url} initials={r.user_display_name.charAt(0).toUpperCase()} size="sm" />
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-semibold text-theme-text">{r.user_display_name}</span>
                </div>
                <div className="text-2xl">{r.emoji}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
