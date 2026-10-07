from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Conversation, ConversationMember, Message, MessageType, MessageReceipt, ReceiptStatus, Reaction
from app.schemas.schemas import MessageCreate, MessageRead, ReactionCreate
from app.api.deps import get_current_user
from app.services.message_service import get_messages, send_message_ws_logic, mark_read_logic
from datetime import datetime, timezone
from app.ws.manager import manager

router = APIRouter(prefix="/api", tags=["messages"])

@router.get("/conversations/{id}/messages", response_model=list[MessageRead])
def list_messages(id: int, before_id: Optional[int] = None, limit: int = 30, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).get(id)
    if not conv or not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    return get_messages(db, id, current_user.id, limit, before_id)

@router.post("/conversations/{id}/messages", response_model=MessageRead)
async def send_message(id: int, data: MessageCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg_dict = await send_message_ws_logic(db, id, current_user.id, data.body, data.reply_to_id)
    if not msg_dict:
        raise HTTPException(status_code=403, detail="Not a member or conv not found")
    return msg_dict

@router.post("/conversations/{id}/read")
async def mark_read(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    await mark_read_logic(db, id, current_user.id)
    return {"message": "Read"}

@router.post("/messages/{id}/reactions")
async def add_reaction(id: int, data: ReactionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).get(id)
    if not msg:
        raise HTTPException(status_code=404)
        
    conv = db.query(Conversation).get(msg.conversation_id)
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    rx = db.query(Reaction).filter_by(message_id=id, user_id=current_user.id).first()
    if rx:
        rx.emoji = data.emoji
    else:
        db.add(Reaction(message_id=id, user_id=current_user.id, emoji=data.emoji))
        
    db.commit()
    
    # Broadcast
    rx_grouped_dict = {}
    for r in msg.reactions:
        if r.emoji not in rx_grouped_dict:
            rx_grouped_dict[r.emoji] = []
        rx_grouped_dict[r.emoji].append(r.user_id)
        
    reactions_summary = [{"emoji": e, "count": len(uids), "user_ids": uids} for e, uids in rx_grouped_dict.items()]
    member_ids = [m.user_id for m in conv.members]
    await manager.send_to_users(member_ids, {
        "type": "reaction.updated",
        "message_id": id,
        "conversation_id": conv.id,
        "user_id": current_user.id,
        "emoji": data.emoji,
        "reactions_summary": reactions_summary
    })
    
    return {"message": "Reaction added"}

@router.delete("/messages/{id}/reactions")
async def remove_reaction_api(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rx = db.query(Reaction).filter_by(message_id=id, user_id=current_user.id).first()
    if rx:
        msg = db.query(Message).get(id)
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
            "message_id": id,
            "conversation_id": conv.id,
            "user_id": current_user.id,
            "emoji": None,
            "reactions_summary": reactions_summary
        })
        
    return {"message": "Reaction removed"}

@router.get("/messages/{id}/reactions")
def get_message_reactions(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).get(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    conv = db.query(Conversation).get(msg.conversation_id)
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    reactions = []
    for r in msg.reactions:
        reactions.append({
            "user_id": r.user_id,
            "emoji": r.emoji,
            "user_display_name": r.user.display_name,
            "user_avatar_url": r.user.avatar_url
        })
    return reactions

@router.delete("/messages/{id}")
async def delete_message(id: int, scope: str = "me", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).get(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    conv = db.query(Conversation).get(msg.conversation_id)
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    if scope == "everyone":
        if msg.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only sender can delete for everyone")
        # within 3 hours
        now = datetime.now(timezone.utc)
        if (now - msg.created_at.replace(tzinfo=timezone.utc)).total_seconds() > 3 * 3600:
            raise HTTPException(status_code=400, detail="Time limit exceeded for delete for everyone")
            
        msg.deleted_at = now
        msg.body = None
        db.commit()
        
        member_ids = [m.user_id for m in conv.members]
        await manager.send_to_users(member_ids, {
            "type": "message.deleted",
            "message_id": msg.id,
            "conversation_id": conv.id
        })
    else:
        from app.models.models import MessageHidden
        hidden = db.query(MessageHidden).filter_by(message_id=msg.id, user_id=current_user.id).first()
        if not hidden:
            db.add(MessageHidden(message_id=msg.id, user_id=current_user.id))
            db.commit()
            
    return {"message": "Deleted"}

@router.get("/messages/{id}/receipts")
def get_message_receipts(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.query(Message).get(id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    conv = db.query(Conversation).get(msg.conversation_id)
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    receipts_data = []
    for r in msg.receipts:
        receipts_data.append({
            "user_id": r.user_id,
            "user_display_name": r.user.display_name,
            "user_avatar_url": r.user.avatar_url,
            "status": r.status.value,
            "timestamp": r.timestamp
        })
    return receipts_data
