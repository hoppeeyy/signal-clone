export interface User {
  id: number;
  phone_number?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  about?: string;
  last_seen?: string;
  is_online: boolean;
  created_at: string;
}

export interface UserSettings {
  user_id: number;
  read_receipts: boolean;
  typing_indicators: boolean;
  last_seen_visibility: 'everyone' | 'nobody';
  notifications_enabled: boolean;
  notification_sound: boolean;
  show_message_preview: boolean;
  theme: string;
  font_size: string;
  disappearing_default_seconds: number | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  is_new_user: boolean;
}

export interface ConversationMember {
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_message_id?: number;
  muted?: boolean;
  muted_until?: string | null;
  user_display_name: string;
  user_avatar_url?: string;
  is_online: boolean;
  last_seen?: string;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name?: string;
  display_name?: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message?: Message;
  unread_count: number;
}

export interface Contact {
  id: number;
  owner_id: number;
  contact_user_id: number;
  nickname?: string;
  created_at: string;
  contact_user: User;
}

export interface MessageReceipt {
  user_id: number;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface Reaction {
  emoji: string;
  user_id: number;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: number[];
}

export interface Attachment {
  id: number;
  message_id?: number;
  uploader_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  kind: 'image' | 'file';
  url: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name?: string;
  body: string | null;
  reply_to_id?: number;
  message_type: 'text' | 'image' | 'file' | 'system' | 'attachment';
  created_at: string;
  deleted?: boolean;
  sender_summary?: {
    id: number;
    display_name?: string;
    avatar_url?: string;
  };
  reply_to_preview?: {
    id: number;
    sender_id: number;
    sender_name?: string | null;
    text_preview?: string | null;
    type: string;
    deleted?: boolean;
  };
  reactions_grouped: ReactionSummary[];
  attachments?: Attachment[];
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}
