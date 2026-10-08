from sqlalchemy.orm import Session, selectinload
from app.models.models import Conversation, Message, MessageReceipt, Reaction, ReceiptStatus, ConversationType, User, ConversationMember, Contact
from typing import Optional, List
from datetime import datetime, timezone

def compute_message_status(msg: Message, user_id: int, conv: Conversation) -> str:
    status = "sent"
    if msg.sender_id != user_id:
        return ""
        
    can_see_read = True
    if msg.sender and msg.sender.settings and not msg.sender.settings.read_receipts:
        can_see_read = False
    
    if conv and conv.type == ConversationType.direct:
        r = next((r for r in msg.receipts if r.user_id != user_id), None)
        if r:
            status = r.status.value
            if status == "read" and not can_see_read:
                status = "delivered"
    elif conv:
        member_count = len(conv.members)
        if len(msg.receipts) > 0 and len(msg.receipts) >= member_count - 1:
            if all(r.status == ReceiptStatus.read for r in msg.receipts):
                status = "read" if can_see_read else "delivered"
            else:
                status = "delivered"
    return status

def format_message(msg: Message, user_id: int, conv: Conversation, contact_map: dict = None) -> dict:
    if contact_map is None:
        contact_map = {}
        
    status = compute_message_status(msg, user_id, conv)
        
    reactions_grouped_dict = {}
    for rx in msg.reactions:
        if rx.emoji not in reactions_grouped_dict:
            reactions_grouped_dict[rx.emoji] = []
        reactions_grouped_dict[rx.emoji].append(rx.user_id)
        
    reactions_grouped = [{"emoji": e, "count": len(uids), "user_ids": uids} for e, uids in reactions_grouped_dict.items()]
        
    sender_summary = None
    if msg.sender:
        sender_summary = {
            "id": msg.sender.id,
            "display_name": contact_map.get(msg.sender.id, msg.sender.display_name),
            "avatar_url": msg.sender.avatar_url
        }
        
    reply_preview = None
    if msg.reply_to:
        reply_is_deleted = msg.reply_to.deleted_at is not None
        
        reply_text = msg.reply_to.body
        if not reply_text and msg.reply_to.attachments:
            att = msg.reply_to.attachments[0]
            if getattr(att, "kind", None) and att.kind.value == "image":
                reply_text = "📷 Photo"
            else:
                reply_text = f"📎 {att.original_name}"
        elif reply_text and msg.reply_to.attachments:
            reply_text = f"📷 {reply_text}"
            
        reply_preview = {
            "id": msg.reply_to.id,
            "sender_id": msg.reply_to.sender_id,
            "sender_name": contact_map.get(msg.reply_to.sender.id, msg.reply_to.sender.display_name) if msg.reply_to.sender else None,
            "text_preview": (reply_text[:100] + '...') if reply_text and len(reply_text) > 100 else reply_text if not reply_is_deleted else None,
            "type": msg.reply_to.message_type.value,
            "deleted": reply_is_deleted
        }
        
    is_deleted = msg.deleted_at is not None
    
    from app.storage import get_storage
    from app.core.config import settings
    
    attachments_list = []
    for att in msg.attachments:
        url = f"/uploads/{att.storage_key}"
        attachments_list.append({
            "id": att.id,
            "message_id": att.message_id,
            "uploader_id": att.uploader_id,
            "original_name": att.original_name,
            "mime_type": att.mime_type,
            "size_bytes": att.size_bytes,
            "width": att.width,
            "height": att.height,
            "kind": att.kind.value,
            "url": url
        })
        
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "body": msg.body if not is_deleted else None,
        "reply_to_id": msg.reply_to_id,
        "message_type": msg.message_type.value,
        "created_at": msg.created_at.isoformat(),
        "sender_summary": sender_summary,
        "reply_to_preview": reply_preview,
        "reactions_grouped": reactions_grouped,
        "attachments": attachments_list,
        "status": status,
        "deleted": is_deleted
    }


def get_messages(db: Session, conversation_id: int, user_id: int, limit: int = 30, before_id: Optional[int] = None):
    from app.models.models import MessageHidden
    
    hidden_subq = db.query(MessageHidden.message_id).filter(MessageHidden.user_id == user_id).subquery()
    
    query = db.query(Message).options(
        selectinload(Message.sender),
        selectinload(Message.reply_to).selectinload(Message.sender),
        selectinload(Message.receipts),
        selectinload(Message.reactions),
        selectinload(Message.attachments)
    ).filter(
        Message.conversation_id == conversation_id,
        Message.id.not_in(hidden_subq)
    )
    
    if before_id:
        query = query.filter(Message.id < before_id)
        
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()
    
    conv = db.query(Conversation).get(conversation_id)
    
    contacts = db.query(Contact).filter(Contact.owner_id == user_id).all()
    contact_map = {c.contact_user_id: c.nickname for c in contacts if c.nickname}
    
    results = []
    for msg in messages:
        results.append(format_message(msg, user_id, conv, contact_map))
    return results

async def send_message_ws_logic(db: Session, conv_id: int, sender_id: int, body: str, reply_to_id: Optional[int] = None, attachment_ids: Optional[List[int]] = None):
    from app.ws.manager import manager
    from app.models.models import Attachment, MessageType
    
    conv = db.query(Conversation).get(conv_id)
    if not conv or not any(m.user_id == sender_id for m in conv.members):
        return None
        
    if reply_to_id:
        replied_msg = db.query(Message).get(reply_to_id)
        if not replied_msg or replied_msg.conversation_id != conv_id or replied_msg.deleted_at is not None:
            return {"error": "Invalid reply_to_id"}
        
    # Validate attachments
    attachments_to_link = []
    if attachment_ids:
        # Max 10 limit
        if len(attachment_ids) > 10:
            return {"error": "Maximum 10 attachments allowed"}
        for att_id in attachment_ids:
            att = db.query(Attachment).get(att_id)
            if not att or att.uploader_id != sender_id or att.message_id is not None:
                return {"error": "Invalid attachment(s)"}
            attachments_to_link.append(att)

    msg_type = MessageType.text
    if attachments_to_link:
        msg_type = MessageType.attachment

    msg = Message(
        conversation_id=conv_id,
        sender_id=sender_id,
        body=body,
        reply_to_id=reply_to_id,
        message_type=msg_type
    )
    db.add(msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.flush()
    
    for att in attachments_to_link:
        att.message_id = msg.id
        
    db.refresh(msg)
    
    member_ids = [m.user_id for m in conv.members if m.user_id != sender_id]
    
    # Check for delivery receipts immediately
    for uid in member_ids:
        if manager.is_online(uid):
            r = MessageReceipt(message_id=msg.id, user_id=uid, status=ReceiptStatus.delivered)
            db.add(r)
    
    db.commit()
    db.refresh(msg)
    
    # Reload with relationships
    msg = db.query(Message).options(
        selectinload(Message.sender),
        selectinload(Message.reply_to).selectinload(Message.sender),
        selectinload(Message.receipts),
        selectinload(Message.reactions),
        selectinload(Message.attachments)
    ).filter(Message.id == msg.id).first()

    # Fetch all contacts for all members in one query to avoid N+1 queries during broadcast
    all_contacts = db.query(Contact).filter(Contact.owner_id.in_(member_ids)).all()
    all_contacts_map = {}
    for c in all_contacts:
        if c.nickname:
            if c.owner_id not in all_contacts_map:
                all_contacts_map[c.owner_id] = {}
            all_contacts_map[c.owner_id][c.contact_user_id] = c.nickname

    # Broadcast to others
    for uid in member_ids:
        contact_map = all_contacts_map.get(uid, {})
        other_msg_dict = format_message(msg, uid, conv, contact_map)
        await manager.send_to_user(uid, {
            "type": "new_message",
            "message": other_msg_dict
        })
        
    # Re-evaluate status for sender
    contacts = db.query(Contact).filter(Contact.owner_id == sender_id).all()
    contact_map = {c.contact_user_id: c.nickname for c in contacts if c.nickname}
    final_sender_dict = format_message(msg, sender_id, conv, contact_map)
    
    # Also send to other tabs of the sender
    await manager.send_to_user(sender_id, {
        "type": "new_message",
        "message": final_sender_dict
    })
    
    return final_sender_dict

async def process_undelivered_receipts(db: Session, user_id: int):
    from app.ws.manager import manager
    
    member_subq = db.query(ConversationMember.conversation_id).filter(ConversationMember.user_id == user_id).subquery()
    
    msgs = db.query(Message).options(selectinload(Message.receipts)).filter(
        Message.conversation_id.in_(member_subq),
        Message.sender_id != user_id
    ).outerjoin(MessageReceipt, (MessageReceipt.message_id == Message.id) & (MessageReceipt.user_id == user_id)).filter(
        MessageReceipt.id == None
    ).all()
    
    updates = {}
    for msg in msgs:
        r = MessageReceipt(message_id=msg.id, user_id=user_id, status=ReceiptStatus.delivered)
        db.add(r)
        if msg.sender_id not in updates:
            updates[msg.sender_id] = []
        updates[msg.sender_id].append(msg)
        
    if msgs:
        db.commit()
        
    # Notify senders
    for sender_id, updated_msgs in updates.items():
        if manager.is_online(sender_id):
            for m in updated_msgs:
                conv = db.query(Conversation).get(m.conversation_id)
                db.refresh(m)
                new_status = compute_message_status(m, sender_id, conv)
                await manager.send_to_user(sender_id, {
                    "type": "message_status",
                    "message_id": m.id,
                    "conversation_id": m.conversation_id,
                    "status": new_status,
                    "user_id": user_id
                })

async def mark_read_logic(db: Session, conv_id: int, user_id: int):
    from app.ws.manager import manager
    conv = db.query(Conversation).get(conv_id)
    if not conv:
        return
        
    member = next((m for m in conv.members if m.user_id == user_id), None)
    if not member:
        return
        
    last_msg = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.id.desc()).first()
    if not last_msg:
        return
        
    user = db.query(User).get(user_id)
    allow_receipts = not (user and user.settings and not user.settings.read_receipts)
    
    member.last_read_message_id = last_msg.id
    db.commit()
    
    if not allow_receipts:
        return
    
    unread_msgs = db.query(Message).filter(
        Message.conversation_id == conv_id,
        Message.sender_id != user_id
    ).all()
    
    updates_by_msg = []
    for msg in unread_msgs:
        existing = db.query(MessageReceipt).filter_by(message_id=msg.id, user_id=user_id).first()
        if existing:
            if existing.status != ReceiptStatus.read:
                existing.status = ReceiptStatus.read
                updates_by_msg.append(msg)
        else:
            db.add(MessageReceipt(message_id=msg.id, user_id=user_id, status=ReceiptStatus.read))
            updates_by_msg.append(msg)
            
    db.commit()
    
    for msg in updates_by_msg:
        if msg.sender_id and manager.is_online(msg.sender_id):
            db.refresh(msg)
            new_status = compute_message_status(msg, msg.sender_id, conv)
            await manager.send_to_user(msg.sender_id, {
                "type": "message_status",
                "message_id": msg.id,
                "conversation_id": msg.conversation_id,
                "status": new_status,
                "user_id": user_id
            })

async def add_reaction_logic(db: Session, message_id: int, user_id: int, emoji: str):
    from app.ws.manager import manager
    msg = db.query(Message).get(message_id)
    if not msg:
        return
        
    conv = db.query(Conversation).get(msg.conversation_id)
    if not any(m.user_id == user_id for m in conv.members):
        return
        
    rx = db.query(Reaction).filter_by(message_id=message_id, user_id=user_id).first()
    if rx:
        rx.emoji = emoji
    else:
        db.add(Reaction(message_id=message_id, user_id=user_id, emoji=emoji))
        
    db.commit()
    
    rx_grouped_dict = {}
    for r in msg.reactions:
        if r.emoji not in rx_grouped_dict:
            rx_grouped_dict[r.emoji] = []
        rx_grouped_dict[r.emoji].append(r.user_id)
        
    reactions_summary = [{"emoji": e, "count": len(uids), "user_ids": uids} for e, uids in rx_grouped_dict.items()]
    
    member_ids = [m.user_id for m in conv.members]
    await manager.send_to_users(member_ids, {
        "type": "reaction.updated",
        "message_id": message_id,
        "conversation_id": conv.id,
        "user_id": user_id,
        "emoji": emoji,
        "reactions_summary": reactions_summary
    })

async def remove_reaction_logic(db: Session, message_id: int, user_id: int):
    from app.ws.manager import manager
    rx = db.query(Reaction).filter_by(message_id=message_id, user_id=user_id).first()
    if rx:
        msg = db.query(Message).get(message_id)
        conv = db.query(Conversation).get(msg.conversation_id)
        db.delete(rx)
        db.commit()
        
        rx_grouped_dict = {}
        for r in msg.reactions:
            if r.emoji not in rx_grouped_dict:
                rx_grouped_dict[r.emoji] = []
            rx_grouped_dict[r.emoji].append(r.user_id)
            
        reactions_summary = [{"emoji": e, "count": len(uids), "user_ids": uids} for e, uids in rx_grouped_dict.items()]
            
        member_ids = [m.user_id for m in conv.members]
        await manager.send_to_users(member_ids, {
            "type": "reaction.updated",
            "message_id": message_id,
            "conversation_id": conv.id,
            "user_id": user_id,
            "emoji": None,
            "reactions_summary": reactions_summary
        })

