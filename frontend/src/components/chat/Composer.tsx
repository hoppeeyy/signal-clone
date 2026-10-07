import { useState, useRef, useEffect, useCallback } from 'react';
import { SmilePlus, Plus, ArrowUp, Mic, X, FileIcon, RefreshCw, Paperclip } from 'lucide-react';
import { useMessages, useMessagesStore } from '@/store/messages';
import { useAuthStore } from '@/store/auth';
import { useChatsStore } from '@/store/chats';
import { fetchApi, API_URL } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import { useWsStore } from '@/store/ws';
import { Message, Conversation } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { EmojiPicker } from './EmojiPicker';
import { cn } from '@/components/ui/Button';

interface PendingAttachment {
  id: string;
  file: File;
  progress: number;
  error?: string;
  attachmentId?: number;
  thumbnailUrl?: string;
  kind: 'image' | 'file';
}

interface ComposerProps {
  conversation: Conversation;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export const Composer = ({ conversation, replyingTo, onCancelReply }: ComposerProps) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const currentUser = useAuthStore(s => s.user);
  const { addMessage, replaceTemp, updateMessage } = useMessages(conversation.id);
  const markConversationRead = useChatsStore(s => s.markConversationRead);
  const wsStatus = useWsStore(s => s.status);
  const upsertConversation = useChatsStore(s => s.upsertConversation);
  const toast = useToast();

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploading = pendingAttachments.some(a => a.progress < 100 && !a.error);
  const [isDragging, setIsDragging] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);

  const sendTypingStart = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingTimeRef.current > 3000) {
      if (useWsStore.getState().status === 'open') {
        wsClient.send({ type: 'typing_start', conversation_id: conversation.id });
        lastTypingTimeRef.current = now;
      }
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (useWsStore.getState().status === 'open') {
        wsClient.send({ type: 'typing_stop', conversation_id: conversation.id });
      }
    }, 2000);
  }, [conversation.id]);

  const sendTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    lastTypingTimeRef.current = 0;
    if (useWsStore.getState().status === 'open') {
      wsClient.send({ type: 'typing_stop', conversation_id: conversation.id });
    }
  }, [conversation.id]);

  const markRead = useCallback(async () => {
    try {
      await fetchApi(`/conversations/${conversation.id}/read`, { method: 'POST' });
      markConversationRead(conversation.id);
    } catch (err) {
      toast('Failed to mark chat as read', 'error');
    }
  }, [conversation.id, markConversationRead, toast]);

  useEffect(() => {
    // Focus textarea on mount
    textareaRef.current?.focus();
    // Mark as read when opening chat
    if (conversation.unread_count > 0) {
      markRead();
    }
  }, [conversation.id, conversation.unread_count, markRead]);

  const handleFocus = () => {
    if (conversation.unread_count > 0) {
      markRead();
    }
  };

  const uploadFile = (attachment: PendingAttachment) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', attachment.file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setPendingAttachments(prev => prev.map(p => 
          p.id === attachment.id ? { ...p, progress: percent } : p
        ));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          setPendingAttachments(prev => prev.map(p => 
            p.id === attachment.id ? { ...p, progress: 100, attachmentId: resp.id } : p
          ));
        } catch (e) {
          setPendingAttachments(prev => prev.map(p => 
            p.id === attachment.id ? { ...p, error: 'Invalid response' } : p
          ));
        }
      } else {
        setPendingAttachments(prev => prev.map(p => 
          p.id === attachment.id ? { ...p, error: 'Upload failed' } : p
        ));
      }
    };

    xhr.onerror = () => {
      setPendingAttachments(prev => prev.map(p => 
        p.id === attachment.id ? { ...p, error: 'Network error' } : p
      ));
    };

    const token = useAuthStore.getState().token;
    xhr.open('POST', `${API_URL.replace('/api', '')}/attachments`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  };

  const handleFilesSelected = (files: FileList | File[]) => {
    const newPending: PendingAttachment[] = [];
    
    Array.from(files).forEach(file => {
      // Validate
      const isImage = file.type.startsWith('image/');
      const isFile = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'].includes(file.type);
      
      if (!isImage && !isFile) {
        toast(`${file.name} has an unsupported file type`, 'error');
        return;
      }
      if (isImage && file.size > 5 * 1024 * 1024) {
        toast(`${file.name} exceeds 5MB limit`, 'error');
        return;
      }
      if (isFile && file.size > 10 * 1024 * 1024) {
        toast(`${file.name} exceeds 10MB limit`, 'error');
        return;
      }

      const attachment: PendingAttachment = {
        id: Math.random().toString(36).slice(2),
        file,
        progress: 0,
        kind: isImage ? 'image' : 'file',
        thumbnailUrl: isImage ? URL.createObjectURL(file) : undefined
      };
      
      newPending.push(attachment);
    });

    if (newPending.length > 0) {
      if (pendingAttachments.length + newPending.length > 10) {
        toast('Maximum 10 attachments allowed', 'error');
        return;
      }
      setPendingAttachments(prev => [...prev, ...newPending]);
      newPending.forEach(uploadFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFilesSelected(e.clipboardData.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const toRemove = prev.find(p => p.id === id);
      if (toRemove?.thumbnailUrl) {
        URL.revokeObjectURL(toRemove.thumbnailUrl);
      }
      if (toRemove?.attachmentId) {
        fetchApi(`/attachments/${toRemove.attachmentId}`, { method: 'DELETE' }).catch(console.error);
      }
      return filtered;
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    if (val.trim() === '') {
      sendTypingStop();
    } else {
      sendTypingStart();
    }

    // Auto-grow
    const target = e.target;
    target.style.height = 'auto';
    const newHeight = Math.min(target.scrollHeight, 120); // max ~6 lines
    target.style.height = `${newHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      
      // Auto-grow
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + emoji.length;
          const target = textareaRef.current;
          target.style.height = 'auto';
          target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          target.focus();
        }
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
  };

  const handleSend = async () => {
    const body = text.trim();
    if ((!body && pendingAttachments.length === 0) || !currentUser || isUploading) return;

    // Reset textarea
    setText('');
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);
    
    sendTypingStop();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    const tempId = Date.now(); // negative or large temporary ID
    const tempMsg: Message = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: currentUser.id,
      body,
      message_type: attachmentsToSend.length > 0 ? 'attachment' : 'text',
      created_at: new Date().toISOString(),
      status: 'sending',
      reactions_grouped: [],
      attachments: attachmentsToSend.map(a => ({
        id: a.attachmentId!,
        uploader_id: currentUser.id,
        original_name: a.file.name,
        mime_type: a.file.type,
        size_bytes: a.file.size,
        kind: a.kind,
        url: a.thumbnailUrl || '' // local url for now
      })),
      reply_to_id: replyingTo?.id,
      reply_to_preview: replyingTo ? {
        id: replyingTo.id,
        sender_id: replyingTo.sender_id,
        sender_name: replyingTo.sender_summary?.display_name || `User ${replyingTo.sender_id}`,
        text_preview: replyingTo.body?.substring(0, 100) || '',
        type: replyingTo.message_type,
        deleted: replyingTo.deleted
      } : undefined
    };

    // Optimistic UI update
    addMessage(tempMsg);
    onCancelReply?.();

    // Update conversation list preview
    upsertConversation({
      ...conversation,
      last_message: tempMsg as Message,
      updated_at: new Date().toISOString(),
      unread_count: 0 // We just read it by focusing
    });

    const isWsOpen = wsStatus === 'open';

    if (isWsOpen) {
      wsClient.send({
        type: 'send_message',
        conversation_id: conversation.id,
        body,
        client_temp_id: tempId,
        reply_to_id: replyingTo?.id,
        attachment_ids: attachmentsToSend.map(a => a.attachmentId).filter(Boolean) as number[]
      });

      setTimeout(() => {
        const storeState = useMessagesStore.getState().conversations[conversation.id];
        const existing = storeState?.messages.find((m: Message) => m.id === tempId);
        if (existing && existing.status === 'sending') {
          updateMessage(tempId, { status: 'failed' });
        }
      }, 10000);
    } else {
      try {
        const payload: any = { body, message_type: attachmentsToSend.length > 0 ? 'attachment' : 'text', reply_to_id: replyingTo?.id };
        if (attachmentsToSend.length > 0) {
          payload.attachment_ids = attachmentsToSend.map(a => a.attachmentId).filter(Boolean);
        }
        const realMsg = await fetchApi<Message>(`/conversations/${conversation.id}/messages`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        replaceTemp(tempId, realMsg);
        upsertConversation({
          ...conversation,
          last_message: realMsg,
          updated_at: realMsg.created_at,
          unread_count: 0
        });
      } catch (err) {
        console.error(err);
        toast('Failed to send message', 'error');
        updateMessage(tempId, { status: 'failed' });
      }
    }
  };

  return (
    <div 
      className="flex flex-col flex-shrink-0 relative z-20"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-theme-app/80 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-theme-primary rounded-t-xl">
          <div className="text-theme-text font-medium text-lg flex items-center gap-2">
            <Plus className="w-6 h-6" /> Drop files to send
          </div>
        </div>
      )}
      {pendingAttachments.length > 0 && (
        <div className="px-4 pt-3 bg-theme-app border-t border-theme-divider flex gap-2 overflow-x-auto">
          {pendingAttachments.map(att => (
            <div key={att.id} className="relative flex-shrink-0 mb-2">
              <div className={cn(
                "w-20 h-20 rounded-xl overflow-hidden border border-theme-divider bg-theme-input flex flex-col items-center justify-center relative group",
                att.error && "border-red-500"
              )}>
                {att.kind === 'image' && att.thumbnailUrl ? (
                  <img src={att.thumbnailUrl} className="w-full h-full object-cover" alt="attachment" />
                ) : (
                  <div className="flex flex-col items-center p-2 text-theme-text-secondary">
                    <FileIcon className="w-8 h-8 mb-1" />
                    <span className="text-[10px] truncate w-full text-center">{att.file.name}</span>
                  </div>
                )}
                
                {att.progress < 100 && !att.error && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  </div>
                )}
                
                {att.error && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[2px]">
                    <button onClick={() => uploadFile(att)} className="text-white bg-red-500/80 p-1.5 rounded-full hover:bg-red-500 transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-theme-secondary text-theme-text-secondary hover:text-theme-text rounded-full shadow flex items-center justify-center border border-theme-divider z-10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {replyingTo && (
        <div className="px-4 py-2 bg-theme-app border-t border-theme-divider flex items-center justify-between">
          <div className="flex-1 flex flex-col border-l-4 border-theme-primary pl-2 overflow-hidden">
            <span className="text-[12px] font-semibold text-theme-primary">
              Replying to {replyingTo.sender_summary?.display_name || `User ${replyingTo.sender_id}`}
            </span>
            <span className="text-[13px] text-theme-text-secondary truncate">
              {replyingTo.deleted ? <i>Original message deleted</i> : replyingTo.body}
            </span>
          </div>
          <button 
            onClick={onCancelReply}
            className="p-2 ml-2 rounded-full hover:bg-theme-row-hover text-theme-text-secondary transition-colors"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>
      )}
      <div className="px-4 py-3 bg-theme-app flex items-end gap-2 border-t border-transparent">
        <div className="flex gap-1 mb-0 relative">
        {showEmojiPicker && (
          <EmojiPicker 
            onSelect={insertEmoji} 
            onClose={() => setShowEmojiPicker(false)} 
          />
        )}
        <button 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-full text-theme-text-secondary hover:bg-theme-row-hover transition-colors"
        >
          <SmilePlus className="w-6 h-6" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,application/pdf,text/plain,.docx,.xlsx,.zip"
          onChange={handleFileInputChange}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-full text-theme-text-secondary hover:bg-theme-row-hover transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 bg-theme-input rounded-3xl px-4 py-2 border-transparent flex items-center min-h-[40px]">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={sendTypingStop}
          placeholder="Message"
          className="w-full bg-transparent outline-none resize-none max-h-[120px] text-[15px] placeholder-theme-text-secondary text-theme-text py-1 leading-[1.3]"
          rows={1}
        />
      </div>

      {text.trim() || pendingAttachments.length > 0 ? (
        <button
          onClick={handleSend}
          disabled={isUploading}
          className={cn(
            "w-[36px] h-[36px] flex-shrink-0 flex items-center justify-center rounded-full transition-all text-white shadow-sm",
            isUploading ? "bg-theme-primary/50 cursor-not-allowed" : "bg-theme-primary hover:bg-theme-primary-hover"
          )}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={() => toast('Mic coming soon', 'info')}
          className="w-[36px] h-[36px] flex-shrink-0 flex items-center justify-center rounded-full transition-all text-theme-text-secondary hover:bg-theme-row-hover"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
      </div>
    </div>
  );
};
