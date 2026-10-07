from sqlalchemy.orm import Session, selectinload
from app.models.models import Conversation, Message, MessageReceipt, Reaction, ReceiptStatus, ConversationType, User, ConversationMember
from typing import Optional, List
from datetime import datetime, timezone

def compute_message_status(msg: Message, user_id: int, conv: Conversation) -> str:
    status = "sent"
    if msg.sender_id != user_id:
        return ""
    
    if conv and conv.type == ConversationType.direct:
        r = next((r for r in msg.receipts if r.user_id != user_id), None)
        if r:
            status = r.status.value
    elif conv:
        member_count = len(conv.members)
        if len(msg.receipts) > 0 and len(msg.receipts) >= member_count - 1:
            if all(r.status == ReceiptStatus.read for r in msg.receipts):
                status = "read"
            else:
                status = "delivered"
    return status

def format_message(msg: Message, user_id: int, conv: Conversation) -> dict:
    status = compute_message_status(msg, user_id, conv)
        
    reactions_grouped = {}
    for rx in msg.reactions:
        if rx.emoji not in reactions_grouped:
            reactions_grouped[rx.emoji] = []
        reactions_grouped[rx.emoji].append(rx.user_id)
        
    sender_summary = None
    if msg.sender:
        sender_summary = {
            "id": msg.sender.id,
            "display_name": msg.sender.display_name,
            "avatar_url": msg.sender.avatar_url
        }
        
    reply_preview = None
    if msg.reply_to:
        reply_preview = {
            "id": msg.reply_to.id,
            "body": msg.reply_to.body,
            "sender_display_name": msg.reply_to.sender.display_name if msg.reply_to.sender else None
        }
        
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "body": msg.body,
        "reply_to_id": msg.reply_to_id,
        "message_type": msg.message_type.value if hasattr(msg.message_type, 'value') else msg.message_type,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "sender_summary": sender_summary,
        "reply_to_preview": reply_preview,
        "reactions_grouped": reactions_grouped,
        "status": status
    }

def get_messages(db: Session, conversation_id: int, user_id: int, limit: int = 30, before_id: Optional[int] = None):
    query = db.query(Message).options(
        selectinload(Message.sender),
        selectinload(Message.reply_to).selectinload(Message.sender),
        selectinload(Message.receipts),
        selectinload(Message.reactions)
    ).filter(Message.conversation_id == conversation_id)
    
    if before_id:
        query = query.filter(Message.id < before_id)
        
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()
    
    conv = db.query(Conversation).get(conversation_id)
    
    results = []
    for msg in messages:
        results.append(format_message(msg, user_id, conv))
    return results

async def send_message_ws_logic(db: Session, conv_id: int, sender_id: int, body: str, reply_to_id: Optional[int] = None):
    from app.ws.manager import manager
    
    conv = db.query(Conversation).get(conv_id)
    if not conv or not any(m.user_id == sender_id for m in conv.members):
        return None
        
    msg = Message(
        conversation_id=conv_id,
        sender_id=sender_id,
        body=body,
        reply_to_id=reply_to_id
    )
    db.add(msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.flush()
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
        selectinload(Message.reactions)
    ).filter(Message.id == msg.id).first()

    # Broadcast to others
    for uid in member_ids:
        other_msg_dict = format_message(msg, uid, conv)
        await manager.send_to_user(uid, {
            "type": "new_message",
            "message": other_msg_dict
        })
        
    # Re-evaluate status for sender
    final_sender_dict = format_message(msg, sender_id, conv)
    
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
        
    member.last_read_message_id = last_msg.id
    
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
