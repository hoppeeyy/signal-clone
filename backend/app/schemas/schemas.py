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

class GroupCreate(BaseModel):
    name: str
    member_ids: List[int]

class DirectCreate(BaseModel):
    user_id: int

class GroupUpdate(BaseModel):
    name: Optional[str] = None

class MemberAdd(BaseModel):
    user_id: int

class MemberRoleUpdate(BaseModel):
    role: MemberRole

# Message
class MessageCreate(BaseModel):
    body: str
    reply_to_id: Optional[int] = None

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
    reactions_grouped: Dict[str, List[int]] = {}
    status: str
