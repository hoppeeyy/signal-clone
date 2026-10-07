'use client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fetchApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Message, MessageReceipt } from '@/lib/types';
import { Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

interface ReceiptWithUser extends MessageReceipt {
  user_display_name: string;
  user_avatar_url?: string;
}

export const MessageInfoModal = ({ isOpen, onClose, message }: MessageInfoModalProps) => {
  const [receipts, setReceipts] = useState<ReceiptWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      const loadReceipts = async () => {
        try {
          setLoading(true);
          const data = await fetchApi<ReceiptWithUser[]>(`/messages/${message.id}/receipts`);
          setReceipts(data);
        } catch (err) {
          toast('Failed to load message info', 'error');
        } finally {
          setLoading(false);
        }
      };
      loadReceipts();
    }
  }, [isOpen, message.id]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Message info">
      <div className="flex flex-col gap-4 mt-2 max-h-[60vh] overflow-y-auto">
        <div className="bg-theme-bubble-out text-white p-3 rounded-[12px] rounded-tr-sm self-end max-w-[80%]">
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
          <div className="text-[10px] text-white/80 text-right mt-1">
            {format(new Date(message.created_at), 'MMM d, h:mm a')}
          </div>
        </div>

        <div className="h-[1px] bg-theme-border my-2" />

        {loading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" />
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-theme-text-secondary text-center py-4">No info available</p>
        ) : (
          <div className="flex flex-col">
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-theme-primary" /> Read by
              </h4>
              <div className="flex flex-col gap-1">
                {receipts.filter(r => r.status === 'read').map(r => (
                  <div key={r.user_id} className="flex items-center gap-3 p-2">
                    <Avatar src={r.user_avatar_url} initials={r.user_display_name.charAt(0).toUpperCase()} size="sm" />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-semibold text-theme-text">{r.user_display_name}</span>
                      <span className="text-xs text-theme-text-secondary">{format(new Date(r.timestamp), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCheck className="w-4 h-4" /> Delivered to
              </h4>
              <div className="flex flex-col gap-1">
                {receipts.filter(r => r.status === 'delivered').map(r => (
                  <div key={r.user_id} className="flex items-center gap-3 p-2">
                    <Avatar src={r.user_avatar_url} initials={r.user_display_name.charAt(0).toUpperCase()} size="sm" />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-semibold text-theme-text">{r.user_display_name}</span>
                      <span className="text-xs text-theme-text-secondary">{format(new Date(r.timestamp), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
