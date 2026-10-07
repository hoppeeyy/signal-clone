from sqlalchemy.orm import Session
from app.models.models import Conversation, ConversationMember, User, Message, ConversationType, MemberRole, MessageType, ReceiptStatus, MessageReceipt, Contact

def get_conversations(db: Session, user_id: int, q: str = None):
    # Find conversations where the user is a member
    member_subq = db.query(ConversationMember.conversation_id).filter(ConversationMember.user_id == user_id).subquery()
    
    query = db.query(Conversation).filter(Conversation.id.in_(member_subq)).order_by(Conversation.updated_at.desc())
    conversations = query.all()
    
    # Pre-fetch contacts for nickname resolution
    contacts = db.query(Contact).filter(Contact.owner_id == user_id).all()
    contact_map = {c.contact_user_id: c.nickname for c in contacts if c.nickname}
    
    results = []
    for conv in conversations:
        # Get my member record
        my_member = next((m for m in conv.members if m.user_id == user_id), None)
        
        display_name = conv.name
        avatar_url = conv.avatar_url
        is_online = None
        last_seen = None
        
        other_user = None
        if conv.type == ConversationType.direct:
            other_member = next((m for m in conv.members if m.user_id != user_id), None)
            if other_member:
                other_user = other_member.user
                display_name = contact_map.get(other_user.id, other_user.display_name)
                avatar_url = other_user.avatar_url
                if not (other_user.settings and other_user.settings.last_seen_visibility == 'nobody'):
                    is_online = other_user.is_online
                    last_seen = other_user.last_seen

        # Filter by q
        if q:
            q_lower = q.lower()
            if not display_name or q_lower not in display_name.lower():
                # For groups, maybe search member names too
                if not any(q_lower in contact_map.get(m.user_id, m.user.display_name).lower() for m in conv.members):
                    continue
        
        # Last message
        last_msg = None
        last_msg_model = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).first()
        if last_msg_model:
            status = "sent"
            if last_msg_model.sender_id != user_id:
                status = ""
            else:
                receipts = last_msg_model.receipts
                if conv.type == ConversationType.direct:
                    r = next((r for r in receipts if r.user_id != user_id), None)
                    if r:
                        status = r.status.value
                else:
                    if len(receipts) > 0 and len(receipts) == len(conv.members) - 1:
                        if all(r.status == ReceiptStatus.read for r in receipts):
                            status = "read"
                        else:
                            status = "delivered"
                            
            sender_name = None
            if last_msg_model.sender:
                sender_name = contact_map.get(last_msg_model.sender_id, last_msg_model.sender.display_name)

            last_msg = {
                "body": last_msg_model.body,
                "sender_id": last_msg_model.sender_id,
                "sender_name": sender_name,
                "message_type": last_msg_model.message_type.value,
                "created_at": last_msg_model.created_at,
                "status": status
            }
            
        # Unread count
        unread_count = 0
        if my_member and last_msg_model:
            if my_member.last_read_message_id:
                last_read = db.query(Message).filter(Message.id == my_member.last_read_message_id).first()
                if last_read:
                    unread_count = db.query(Message).filter(
                        Message.conversation_id == conv.id,
                        Message.created_at > last_read.created_at,
                        Message.sender_id != user_id,
                        Message.message_type != MessageType.system
                    ).count()
            else:
                unread_count = db.query(Message).filter(
                    Message.conversation_id == conv.id,
                    Message.sender_id != user_id,
                    Message.message_type != MessageType.system
                ).count()
                
        muted = False
        muted_until = None
        if my_member:
            muted = my_member.muted
            muted_until = my_member.muted_until
            
        # Serialize members
        members_data = []
        for m in conv.members:
            u_is_online = m.user.is_online
            u_last_seen = m.user.last_seen
            if m.user.settings and m.user.settings.last_seen_visibility == 'nobody':
                u_is_online = False
                u_last_seen = None
            
            members_data.append({
                "user_id": m.user_id,
                "role": m.role.value if hasattr(m.role, 'value') else m.role,
                "joined_at": m.joined_at,
                "user_display_name": contact_map.get(m.user_id, m.user.display_name),
                "user_avatar_url": m.user.avatar_url,
                "is_online": u_is_online,
                "last_seen": u_last_seen
            })
            
        results.append({
            "id": conv.id,
            "type": conv.type,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "updated_at": conv.updated_at,
            "last_message": last_msg,
            "unread_count": unread_count,
            "is_online": is_online,
            "last_seen": last_seen,
            "muted": muted,
            "muted_until": muted_until,
            "members": members_data
        })
        
    return results
