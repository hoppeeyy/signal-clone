import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConversationType(str, enum.Enum):
    direct = "direct"
    group = "group"

class MemberRole(str, enum.Enum):
    admin = "admin"
    member = "member"

class MessageType(str, enum.Enum):
    text = "text"
    system = "system"
    attachment = "attachment"

class ReceiptStatus(str, enum.Enum):
    delivered = "delivered"
    read = "read"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, nullable=True, index=True)
    username = Column(String, unique=True, nullable=True, index=True)
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    about = Column(String, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    is_online = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    contacts = relationship("Contact", foreign_keys="Contact.owner_id", back_populates="owner", cascade="all, delete-orphan")
    conversations = relationship("ConversationMember", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")

class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    read_receipts = Column(Boolean, default=True)
    typing_indicators = Column(Boolean, default=True)
    last_seen_visibility = Column(String, default='everyone') # 'everyone' | 'nobody'
    notifications_enabled = Column(Boolean, default=True)
    notification_sound = Column(Boolean, default=True)
    show_message_preview = Column(Boolean, default=True)
    theme = Column(String, default='system')
    font_size = Column(String, default='medium')
    disappearing_default_seconds = Column(Integer, nullable=True)

    user = relationship("User", back_populates="settings")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contact_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nickname = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("owner_id", "contact_user_id", name="uq_owner_contact"),)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_user_id])

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(ConversationType), nullable=False)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    disappearing_timer_seconds = Column(Integer, nullable=True)

    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(MemberRole), default=MemberRole.member, nullable=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_read_message_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    muted = Column(Boolean, default=False)
    muted_until = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conv_user"),)

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", back_populates="conversations")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(String, nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    message_type = Column(Enum(MessageType), default=MessageType.text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (Index("ix_message_conv_created", "conversation_id", "created_at"),)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")
    replies = relationship("Message", backref="reply_to", remote_side=[id])
    receipts = relationship("MessageReceipt", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("Reaction", back_populates="message", cascade="all, delete-orphan")

class MessageReceipt(Base):
    __tablename__ = "message_receipts"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(ReceiptStatus), nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_msg_user_receipt"),)

    message = relationship("Message", back_populates="receipts")
    user = relationship("User")

class Reaction(Base):
    __tablename__ = "reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String, nullable=False)

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_msg_user_reaction"),)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")

class MessageHidden(Base):
    __tablename__ = "message_hidden"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_msg_user_hidden"),)

    message = relationship("Message")
    user = relationship("User")
