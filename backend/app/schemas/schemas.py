from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.models import ConversationType, MemberRole, MessageType

# User
class UserBase(BaseModel):
    phone_number: Optional[str] = None
    username: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    about: Optional[str] = None

class UserRead(UserBase):
    id: int
    last_seen: Optional[datetime] = None
    is_online: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    about: Optional[str] = None
    avatar_url: Optional[str] = None

class UserSettingsRead(BaseModel):
    read_receipts: bool
    typing_indicators: bool
    last_seen_visibility: str
    notifications_enabled: bool
    notification_sound: bool
    show_message_preview: bool
    theme: str
    font_size: str
    disappearing_default_seconds: Optional[int] = None
    
    class Config:
        from_attributes = True

class UserSettingsUpdate(BaseModel):
    read_receipts: Optional[bool] = None
    typing_indicators: Optional[bool] = None
    last_seen_visibility: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    notification_sound: Optional[bool] = None
    show_message_preview: Optional[bool] = None
    theme: Optional[str] = None
    font_size: Optional[str] = None
    disappearing_default_seconds: Optional[int] = None

# Auth
class RequestOTP(BaseModel):
    identifier: str

class VerifyOTP(BaseModel):
    identifier: str
    otp: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    is_new_user: bool

# Contact
class ContactCreate(BaseModel):
    identifier: str
    nickname: Optional[str] = None

class ContactRead(BaseModel):
    id: int
    nickname: Optional[str] = None
    created_at: datetime
    contact_user: UserRead
    class Config:
        from_attributes = True

# Conversation
class ConversationMemberRead(BaseModel):
    user_id: int
    role: MemberRole
    joined_at: datetime
    user_display_name: str
    user_avatar_url: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConversationListRead(BaseModel):
    id: int
    type: ConversationType
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    updated_at: datetime
    last_message: Optional[Dict[str, Any]] = None
    unread_count: int = 0
    is_online: Optional[bool] = None
    last_seen: Optional[datetime] = None
    muted: bool = False
    muted_until: Optional[datetime] = None
    members: List[ConversationMemberRead] = []

    class Config:
        from_attributes = True

class ConversationDetailRead(BaseModel):
    id: int
    type: ConversationType
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    disappearing_timer_seconds: Optional[int] = None
    members: List[ConversationMemberRead] = []

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    member_ids: List[int]
    avatar_url: Optional[str] = None

class DirectCreate(BaseModel):
    user_id: int

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class MemberAdd(BaseModel):
    user_ids: List[int]

class MemberRoleUpdate(BaseModel):
    role: MemberRole

class MuteUpdate(BaseModel):
    muted: bool
    muted_until: Optional[datetime] = None

class MessageReceiptRead(BaseModel):
    user_id: int
    user_display_name: str
    user_avatar_url: Optional[str] = None
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Message
class MessageCreate(BaseModel):
    body: Optional[str] = None
    reply_to_id: Optional[int] = None
    attachment_ids: Optional[List[int]] = None

class AttachmentRead(BaseModel):
    id: int
    message_id: Optional[int]
    uploader_id: int
    original_name: str
    mime_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    kind: str
    url: str

    class Config:
        from_attributes = True

class ReactionCreate(BaseModel):
    emoji: str

class MessageRead(BaseModel):
    id: int
    conversation_id: int
    sender_id: Optional[int] = None
    body: Optional[str] = None
    reply_to_id: Optional[int] = None
    message_type: MessageType
    created_at: datetime
    
    sender_summary: Optional[Dict[str, Any]] = None
    reply_to_preview: Optional[Dict[str, Any]] = None
    reactions_grouped: List[Dict[str, Any]] = []
    attachments: List[AttachmentRead] = []
    status: str

    class Config:
        from_attributes = True
