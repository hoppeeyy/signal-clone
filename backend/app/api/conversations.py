from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Conversation, ConversationMember, ConversationType, MemberRole, Message, MessageType
from app.schemas.schemas import ConversationListRead, ConversationDetailRead, GroupCreate, DirectCreate, GroupUpdate, MemberAdd, MemberRoleUpdate, MuteUpdate
from app.api.deps import get_current_user
import hashlib
from app.services.conversation_service import get_conversations
from datetime import datetime, timezone
from fastapi import BackgroundTasks
from app.ws.manager import manager

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

@router.get("", response_model=list[ConversationListRead])
def list_conversations(q: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_conversations(db, current_user.id, q)

@router.post("/direct", response_model=ConversationDetailRead)
def create_direct(data: DirectCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot create direct chat with yourself")
    
    other_user = db.query(User).filter(User.id == data.user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if direct conversation already exists
    my_directs = db.query(ConversationMember.conversation_id).join(Conversation).filter(
        ConversationMember.user_id == current_user.id,
        Conversation.type == ConversationType.direct
    ).subquery()
    
    existing = db.query(ConversationMember).filter(
        ConversationMember.conversation_id.in_(my_directs),
        ConversationMember.user_id == data.user_id
    ).first()
    
    if existing:
        conv = db.query(Conversation).get(existing.conversation_id)
        for m in conv.members:
            m.user_display_name = m.user.display_name
            m.user_avatar_url = m.user.avatar_url
        return conv
        
    conv = Conversation(type=ConversationType.direct, created_by=current_user.id)
    db.add(conv)
    db.flush()
    
    m1 = ConversationMember(conversation_id=conv.id, user_id=current_user.id)
    m2 = ConversationMember(conversation_id=conv.id, user_id=data.user_id)
    db.add_all([m1, m2])
    db.commit()
    db.refresh(conv)
    
    for m in conv.members:
        m.user_display_name = m.user.display_name
        m.user_avatar_url = m.user.avatar_url
        
    member_ids = [m.user_id for m in conv.members]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return conv

@router.post("/group", response_model=ConversationDetailRead)
def create_group(data: GroupCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    other_members = [uid for uid in set(data.member_ids) if uid != current_user.id]
    if len(other_members) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 other members required")
        
    conv = Conversation(type=ConversationType.group, name=data.name, avatar_url=data.avatar_url, created_by=current_user.id)
    db.add(conv)
    db.flush()
    
    m1 = ConversationMember(conversation_id=conv.id, user_id=current_user.id, role=MemberRole.admin)
    db.add(m1)
    
    for uid in other_members:
        db.add(ConversationMember(conversation_id=conv.id, user_id=uid))
            
    sys_msg = Message(
        conversation_id=conv.id,
        body=f"{current_user.display_name} created the group",
        message_type=MessageType.system
    )
    db.add(sys_msg)
    
    db.commit()
    db.refresh(conv)
    
    for m in conv.members:
        m.user_display_name = m.user.display_name
        m.user_avatar_url = m.user.avatar_url
        if not (m.user.settings and m.user.settings.last_seen_visibility == 'nobody'):
            m.is_online = m.user.is_online
            m.last_seen = m.user.last_seen
        else:
            m.is_online = False
            m.last_seen = None
        
    member_ids = [m.user_id for m in conv.members]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return conv

@router.get("/{id}", response_model=ConversationDetailRead)
def get_conversation(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    for m in conv.members:
        m.user_display_name = m.user.display_name
        m.user_avatar_url = m.user.avatar_url
        if not (m.user.settings and m.user.settings.last_seen_visibility == 'nobody'):
            m.is_online = m.user.is_online
            m.last_seen = m.user.last_seen
        else:
            m.is_online = False
            m.last_seen = None
    return conv

@router.get("/{id}/members")
def get_conversation_members(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
        
    members_data = []
    for m in conv.members:
        is_online = m.user.is_online
        last_seen = m.user.last_seen
        if m.user.settings and m.user.settings.last_seen_visibility == 'nobody':
            is_online = False
            last_seen = None
            
        members_data.append({
            "user_id": m.user_id,
            "role": m.role.value,
            "joined_at": m.joined_at,
            "user_display_name": m.user.display_name,
            "user_avatar_url": m.user.avatar_url,
            "is_online": is_online,
            "last_seen": last_seen
        })
    return members_data

@router.patch("/{id}")
def update_group(id: int, data: GroupUpdate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not member or member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    if data.name is not None and data.name != conv.name:
        sys_msg = Message(
            conversation_id=conv.id,
            body=f"{current_user.display_name} renamed the group to {data.name}",
            message_type=MessageType.system
        )
        db.add(sys_msg)
        conv.name = data.name
        
    if data.avatar_url is not None and data.avatar_url != conv.avatar_url:
        sys_msg = Message(
            conversation_id=conv.id,
            body=f"{current_user.display_name} changed the group avatar",
            message_type=MessageType.system
        )
        db.add(sys_msg)
        conv.avatar_url = data.avatar_url
        
    db.commit()
    
    member_ids = [m.user_id for m in conv.members]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return {"message": "Updated"}

@router.post("/{id}/members")
def add_member(id: int, data: MemberAdd, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not member or member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    existing_user_ids = {m.user_id for m in conv.members}
    added_users = []
    
    for uid in data.user_ids:
        if uid in existing_user_ids:
            continue
        new_user = db.query(User).get(uid)
        if new_user:
            db.add(ConversationMember(conversation_id=conv.id, user_id=uid))
            added_users.append(new_user)
    
    if not added_users:
        return {"message": "No new members added"}
        
    names = ", ".join([u.display_name for u in added_users])
    sys_msg = Message(
        conversation_id=conv.id,
        body=f"{current_user.display_name} added {names}",
        message_type=MessageType.system
    )
    db.add(sys_msg)
    db.commit()
    
    # Broadcast to members including new members
    member_ids = [m.user_id for m in conv.members] + [u.id for u in added_users]
    background_tasks.add_task(manager.send_to_users, list(set(member_ids)), {
        "type": "group.member_added",
        "conversation_id": conv.id,
        "added_user_ids": [u.id for u in added_users]
    })
    
    return {"message": "Members added"}

@router.delete("/{id}/members/{user_id}")
def remove_member(id: int, user_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    my_member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not my_member:
        raise HTTPException(status_code=403, detail="Not a member")
        
    if user_id != current_user.id and my_member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    target_member = next((m for m in conv.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    is_admin = target_member.role == MemberRole.admin
    db.delete(target_member)
    db.flush()
    
    if is_admin:
        admins_left = [m for m in conv.members if m.role == MemberRole.admin and m.user_id != user_id]
        if not admins_left:
            # Promote oldest member
            oldest = min((m for m in conv.members if m.user_id != user_id), key=lambda x: x.joined_at, default=None)
            if oldest:
                oldest.role = MemberRole.admin
    
    action = "left" if user_id == current_user.id else f"removed {target_member.user.display_name}"
    sys_msg = Message(
        conversation_id=conv.id,
        body=f"{current_user.display_name} {action}",
        message_type=MessageType.system
    )
    db.add(sys_msg)
    db.commit()
    
    member_ids = [m.user_id for m in conv.members] + [user_id]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "group.member_removed",
        "conversation_id": conv.id,
        "removed_user_id": user_id
    })
    
    return {"message": "Member removed"}

@router.post("/{id}/members/{user_id}/promote")
def promote_member(id: int, user_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    my_member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not my_member or my_member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    target_member = next((m for m in conv.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if target_member.role == MemberRole.admin:
        return {"message": "Already an admin"}
            
    target_member.role = MemberRole.admin
    db.commit()
    
    member_ids = [m.user_id for m in conv.members]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return {"message": "Role updated"}

@router.patch("/{id}/mute")
def mute_conversation(id: int, data: MuteUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(ConversationMember).filter(ConversationMember.conversation_id == id, ConversationMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")
    
    member.muted = data.muted
    member.muted_until = data.muted_until
    db.commit()
    return {"message": "Mute settings updated"}

@router.get("/{id}/safety-number")
def get_safety_number(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(m.user_id == current_user.id for m in conv.members):
        raise HTTPException(status_code=403, detail="Not a member")
    
    # Generate deterministic 60-digit number
    member_ids = sorted([m.user_id for m in conv.members])
    hash_input = "-".join(map(str, member_ids)).encode('utf-8')
    h = hashlib.sha256(hash_input).digest()
    
    # Convert bytes to a very large integer and pad/truncate to 60 digits
    num_str = str(int.from_bytes(h, byteorder='big')).zfill(60)[:60]
    
    # Format in 12 groups of 5 digits
    formatted = " ".join([num_str[i:i+5] for i in range(0, 60, 5)])
    return {"safety_number": formatted}
