import { memo, useState } from 'react';
import { format } from 'date-fns';
import { Reply, SmilePlus, MoreHorizontal, Copy, AlertCircle, Trash2, FileIcon, Download } from 'lucide-react';
import { Message } from '@/lib/types';
import { cn } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useMessages } from '@/store/messages';
import { useAuthStore } from '@/store/auth';
import { fetchApi } from '@/lib/api';
import { EmojiPicker } from './EmojiPicker';
import { MessageInfoModal } from './MessageInfoModal';
import { ReactionInfoModal } from './ReactionInfoModal';
import { Info } from 'lucide-react';
import { DeliveryIcon } from './DeliveryIcon';
import { DeleteMessageModal } from './DeleteMessageModal';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showSenderName: boolean;
  onReply: (message: Message) => void;
}

const linkify = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const colors = ['text-red-500', 'text-blue-500', 'text-green-500', 'text-purple-500', 'text-orange-500', 'text-teal-500'];
const getSenderColor = (id: number) => colors[id % colors.length];

export const MessageBubble = memo(({ message, isOwn, isGroup, isFirstInGroup, isLastInGroup, showSenderName, onReply }: MessageBubbleProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showReactionInfo, setShowReactionInfo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const toast = useToast();
  const { updateMessage, replaceTemp, removeMessage } = useMessages(message.conversation_id);
  const currentUser = useAuthStore(s => s.user);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.body || '');
    toast('Copied to clipboard', 'info');
  };

  const handleAction = (name: string) => {
    if (name === 'React') {
      setShowReactionPicker(true);
      return;
    }
    if (name === 'Reply') {
      onReply(message);
      return;
    }
    if (name === 'Info') {
      setShowInfo(true);
      return;
    }
    if (name === 'Delete') {
      setShowDeleteModal(true);
      return;
    }
    toast(`${name} coming soon`, 'info');
  };

  const handleSelectReaction = async (emoji: string) => {
    try {
      const existingReaction = message.reactions_grouped?.find(r => r.emoji === emoji);
      const isRemoving = existingReaction?.user_ids.includes(currentUser?.id || 0);
      if (isRemoving) {
        await fetchApi(`/messages/${message.id}/reactions`, { method: 'DELETE' });
      } else {
        await fetchApi(`/messages/${message.id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji })
        });
      }
    } catch (e) {
      console.error('Failed to react', e);
      toast('Failed to react', 'error');
    }
  };

  const handleRetry = async () => {
    updateMessage(message.id, { status: 'sending' });
    try {
      const realMsg = await fetchApi<Message>(`/conversations/${message.conversation_id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: message.body, message_type: message.message_type })
      });
      replaceTemp(message.id, realMsg);
    } catch (err) {
      console.error(err);
      updateMessage(message.id, { status: 'failed' });
    }
  };

  const handleDelete = () => {
    removeMessage(message.id);
  };

  const handleQuoteClick = () => {
    if (!message.reply_to_preview) return;
    const el = document.getElementById(`message-${message.reply_to_preview.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-theme-row-hover');
      setTimeout(() => el.classList.remove('bg-theme-row-hover'), 1500);
    } else {
      toast('Original message not available', 'info');
    }
  };

  const timeStr = format(new Date(message.created_at), 'h:mm a');

  return (
    <div 
      id={`message-${message.id}`}
      className={cn(
        "flex w-full px-4 relative group",
        isOwn ? "justify-end" : "justify-start",
        isLastInGroup ? "mb-3" : "mb-0.5"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isOwn && isGroup && (
        <div className="w-8 mr-2 flex-shrink-0 flex items-end">
          {isLastInGroup && (
            <Avatar 
              src={message.sender_summary?.avatar_url} 
              initials={message.sender_summary?.display_name?.charAt(0).toUpperCase() || '?'} 
              size="sm"
            />
          )}
        </div>
      )}

      <div className={cn(
        "flex flex-col relative max-w-[65%]",
        isOwn ? "items-end" : "items-start"
      )}>
        {showSenderName && !isOwn && isGroup && (
          <span className={cn("text-[11px] font-semibold mb-1 ml-1", getSenderColor(message.sender_id))}>
            {message.sender_summary?.display_name || `User ${message.sender_id}`}
          </span>
        )}
        
        <div className={cn(
          "px-3 py-2 text-[15px] leading-[1.3] relative break-words whitespace-pre-wrap",
          isOwn ? "bg-theme-bubble-out text-white" : "bg-theme-bubble-in text-theme-text",
          // Bubble radiuses
          "rounded-[18px]",
          isOwn && isFirstInGroup && !isLastInGroup && "rounded-br-[4px]",
          isOwn && !isFirstInGroup && !isLastInGroup && "rounded-r-[4px]",
          isOwn && !isFirstInGroup && isLastInGroup && "rounded-tr-[4px]",
          !isOwn && isFirstInGroup && !isLastInGroup && "rounded-bl-[4px]",
          !isOwn && !isFirstInGroup && !isLastInGroup && "rounded-l-[4px]",
          !isOwn && !isFirstInGroup && isLastInGroup && "rounded-tl-[4px]"
        )}>
          {message.reply_to_preview && (
            <div 
              onClick={handleQuoteClick}
              className={cn(
                "mb-2 rounded flex flex-col overflow-hidden cursor-pointer",
                isOwn ? "bg-black/10" : "bg-black/5"
              )}
            >
              <div className={cn(
                "px-2 py-1 border-l-4",
                isOwn ? "border-white" : getSenderColor(message.reply_to_preview.sender_id).replace('text-', 'border-')
              )}>
                <span className="text-[12px] font-semibold block mb-0.5 opacity-90">
                  {message.reply_to_preview.sender_name || 'User'}
                </span>
                <span className="text-[13px] opacity-80 line-clamp-2 leading-tight">
                  {message.reply_to_preview.deleted ? (
                    <i className="text-theme-text-secondary">Original message deleted</i>
                  ) : (
                    message.reply_to_preview.text_preview || 'Message'
                  )}
                </span>
              </div>
            </div>
          )}
          
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-col gap-2 mb-2 w-full">
              {/* Image Grid */}
              {message.attachments.filter(a => a.kind === 'image').length > 0 && (
                <div className={cn(
                  "grid gap-1 overflow-hidden rounded",
                  message.attachments.filter(a => a.kind === 'image').length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                  {message.attachments.filter(a => a.kind === 'image').map(img => (
                    <div key={img.id} className="relative group/img cursor-pointer max-h-64 overflow-hidden bg-black/10">
                      <img 
                        src={img.url} 
                        alt={img.original_name} 
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                        onClick={() => window.open(img.url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* File Cards */}
              {message.attachments.filter(a => a.kind === 'file').map(file => (
                <div 
                  key={file.id} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border max-w-sm cursor-pointer hover:opacity-90 transition-opacity",
                    isOwn ? "bg-white/10 border-white/20" : "bg-theme-input border-theme-divider"
                  )}
                  onClick={() => window.open(file.url, '_blank')}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    isOwn ? "bg-white/20 text-white" : "bg-theme-primary/10 text-theme-primary"
                  )}>
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-medium text-[14px] truncate" title={file.original_name}>
                      {file.original_name}
                    </span>
                    <span className={cn(
                      "text-[12px]",
                      isOwn ? "text-white/70" : "text-theme-text-secondary"
                    )}>
                      {formatSize(file.size_bytes)}
                    </span>
                  </div>
                  <button 
                    className={cn(
                      "p-1.5 rounded-full",
                      isOwn ? "hover:bg-white/20" : "hover:bg-theme-row-hover text-theme-text-secondary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      const a = document.createElement('a');
                      a.href = file.url;
                      a.download = file.original_name;
                      a.click();
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {message.deleted ? (
            <span className="italic text-white/70">This message was deleted</span>
          ) : (
            message.body ? linkify(message.body) : null
          )}

          <div className="inline-flex items-center gap-1 ml-2 translate-y-1 float-right mt-1.5 opacity-80">
            <span className={cn("text-[11px] whitespace-nowrap", isOwn ? "text-white/70" : "text-theme-text-secondary")}>
              {timeStr}
            </span>
            {isOwn && (
              <span className="flex items-center">
                <DeliveryIcon status={message.status} />
              </span>
            )}
          </div>
        </div>

        {isOwn && message.status === 'failed' && (
          <div className="flex items-center gap-2 mt-1 text-red-500">
            <button onClick={handleRetry} className="flex items-center gap-1 hover:underline text-[12px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed to send. Tap to retry</span>
            </button>
            <button onClick={handleDelete} className="p-1 hover:bg-red-50 rounded-full" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reactions */}
        {message.reactions_grouped && message.reactions_grouped.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1 mt-1 z-10",
            isOwn ? "justify-end mr-1" : "justify-start ml-1"
          )}>
            {message.reactions_grouped.map((rx) => {
              const hasReacted = rx.user_ids.includes(currentUser?.id || 0);
              return (
                <button
                  key={rx.emoji}
                  onClick={() => handleSelectReaction(rx.emoji)}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors",
                    hasReacted 
                      ? "bg-theme-primary/10 border-theme-primary text-theme-primary" 
                      : "bg-theme-app border-theme-divider text-theme-text-secondary hover:bg-theme-row-hover"
                  )}
                >
                  <span>{rx.emoji}</span>
                  <span 
                    className="font-medium px-0.5" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionInfo(true);
                    }}
                  >
                    {rx.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hover Actions */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 bg-theme-app border border-theme-divider rounded-full p-1 shadow-sm transition-opacity duration-200 z-10",
          isOwn ? "right-full mr-2" : "left-full ml-2",
          (isHovered || showReactionPicker) ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <div className="relative">
            <button onClick={() => handleAction('React')} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
              <SmilePlus className="w-4 h-4" />
            </button>
            {showReactionPicker && (
              <EmojiPicker 
                onSelect={handleSelectReaction} 
                onClose={() => setShowReactionPicker(false)} 
              />
            )}
          </div>
          <button onClick={() => handleAction('Reply')} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
            <Reply className="w-4 h-4" />
          </button>
          {isOwn && isGroup && (
            <button onClick={() => handleAction('Info')} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
              <Info className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleCopy} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={() => handleAction('More')} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button onClick={() => handleAction('Delete')} className="p-1.5 hover:bg-theme-row-hover rounded-full text-theme-text-secondary">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {showInfo && (
        <MessageInfoModal 
          isOpen={showInfo} 
          onClose={() => setShowInfo(false)} 
          message={message} 
        />
      )}
      
      {showReactionInfo && (
        <ReactionInfoModal
          isOpen={showReactionInfo}
          onClose={() => setShowReactionInfo(false)}
          message={message}
        />
      )}
      
      {showDeleteModal && (
        <DeleteMessageModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleteForMe={() => {
            fetchApi(`/messages/${message.id}?scope=me`, { method: 'DELETE' }).then(() => {
              removeMessage(message.id);
              setShowDeleteModal(false);
            });
          }}
          onDeleteForEveryone={isOwn ? () => {
            fetchApi(`/messages/${message.id}?scope=everyone`, { method: 'DELETE' }).then(() => {
              // Usually the WS event will handle the UI update, but we can do it optimistically or wait.
              setShowDeleteModal(false);
            }).catch(() => {
              toast('Failed to delete for everyone', 'error');
              setShowDeleteModal(false);
            });
          } : undefined}
        />
      )}
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';
