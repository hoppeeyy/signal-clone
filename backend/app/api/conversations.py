from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Conversation, ConversationMember, ConversationType, MemberRole, Message, MessageType
from app.schemas.schemas import ConversationListRead, ConversationDetailRead, GroupCreate, DirectCreate, GroupUpdate, MemberAdd, MemberRoleUpdate
from app.api.deps import get_current_user
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
    conv = Conversation(type=ConversationType.group, name=data.name, created_by=current_user.id)
    db.add(conv)
    db.flush()
    
    m1 = ConversationMember(conversation_id=conv.id, user_id=current_user.id, role=MemberRole.admin)
    db.add(m1)
    
    for uid in data.member_ids:
        if uid != current_user.id:
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
    return conv

@router.patch("/{id}")
def update_group(id: int, data: GroupUpdate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not member or member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    if data.name is not None:
        conv.name = data.name
        sys_msg = Message(
            conversation_id=conv.id,
            body=f"{current_user.display_name} renamed the group to {data.name}",
            message_type=MessageType.system
        )
        db.add(sys_msg)
        
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
        
    if any(m.user_id == data.user_id for m in conv.members):
        raise HTTPException(status_code=409, detail="User already in group")
        
    new_user = db.query(User).get(data.user_id)
    db.add(ConversationMember(conversation_id=conv.id, user_id=data.user_id))
    
    sys_msg = Message(
        conversation_id=conv.id,
        body=f"{current_user.display_name} added {new_user.display_name}",
        message_type=MessageType.system
    )
    db.add(sys_msg)
    db.commit()
    
    # Broadcast to members including new member
    member_ids = [m.user_id for m in conv.members] + [data.user_id]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return {"message": "Member added"}

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
        
    db.delete(target_member)
    
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
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return {"message": "Member removed"}

@router.patch("/{id}/members/{user_id}")
def update_member_role(id: int, user_id: int, data: MemberRoleUpdate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.type == ConversationType.group).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group not found")
        
    my_member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not my_member or my_member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    target_member = next((m for m in conv.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if data.role == MemberRole.member and target_member.role == MemberRole.admin:
        admins = [m for m in conv.members if m.role == MemberRole.admin]
        if len(admins) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove last admin")
            
    target_member.role = data.role
    db.commit()
    
    member_ids = [m.user_id for m in conv.members]
    background_tasks.add_task(manager.send_to_users, member_ids, {
        "type": "conversation_updated",
        "conversation_id": conv.id
    })
    
    return {"message": "Role updated"}
