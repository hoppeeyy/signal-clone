import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.models.models import (
    User, UserSettings, Contact, Conversation, ConversationMember, 
    Message, MessageReceipt, ConversationType, MemberRole, MessageType, ReceiptStatus
)

def get_random_date():
    now = datetime.now(timezone.utc)
    # Between 1 and 5 days ago
    days_ago = random.randint(1, 5)
    hours_ago = random.randint(0, 23)
    minutes_ago = random.randint(0, 59)
    return now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)

def seed_db():
    db = SessionLocal()
    
    # Check if we already have users
    if db.query(User).count() > 0:
        print("Database already seeded.")
        db.close()
        return

    users_data = [
        {"phone_number": "+1234567890", "username": "alice_w", "display_name": "Alice Wonderland", "avatar_url": "https://i.pravatar.cc/150?u=alice"},
        {"phone_number": "+1234567891", "username": "bob_b", "display_name": "Bob Builder", "avatar_url": "https://i.pravatar.cc/150?u=bob"},
        {"phone_number": "+1234567892", "username": "charlie_c", "display_name": "Charlie Chaplin", "avatar_url": "https://i.pravatar.cc/150?u=charlie"},
        {"phone_number": "+1234567893", "username": "diana_p", "display_name": "Diana Prince", "avatar_url": "https://i.pravatar.cc/150?u=diana"},
        {"phone_number": "+1234567894", "username": "edward_s", "display_name": "Edward Scissorhands", "avatar_url": "https://i.pravatar.cc/150?u=edward"},
        {"phone_number": "+1234567895", "username": "fiona_s", "display_name": "Fiona Shrek", "avatar_url": "https://i.pravatar.cc/150?u=fiona"},
        {"phone_number": "+1234567896", "username": "george_c", "display_name": "George Costanza", "avatar_url": "https://i.pravatar.cc/150?u=george"},
        {"phone_number": "+1234567897", "username": "hannah_m", "display_name": "Hannah Montana", "avatar_url": "https://i.pravatar.cc/150?u=hannah"},
    ]

    users = []
    for data in users_data:
        user = User(**data, is_online=random.choice([True, False]), last_seen=get_random_date())
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create default user settings
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        users.append(user)
    db.commit()

    # Create contacts
    for u1 in users:
        # Each user has 3-5 random contacts
        num_contacts = random.randint(3, 5)
        contact_candidates = [u for u in users if u.id != u1.id]
        chosen_contacts = random.sample(contact_candidates, num_contacts)
        for u2 in chosen_contacts:
            contact = Contact(owner_id=u1.id, contact_user_id=u2.id, nickname=u2.display_name)
            db.add(contact)
    db.commit()

    # Create 5 direct conversations
    direct_pairs = [
        (users[0], users[1]),
        (users[0], users[2]),
        (users[1], users[3]),
        (users[4], users[5]),
        (users[6], users[7])
    ]
    
    conversations = []
    for p1, p2 in direct_pairs:
        conv = Conversation(type=ConversationType.direct, created_by=p1.id, created_at=get_random_date())
        db.add(conv)
        db.commit()
        db.refresh(conv)
        
        m1 = ConversationMember(conversation_id=conv.id, user_id=p1.id, joined_at=conv.created_at)
        m2 = ConversationMember(conversation_id=conv.id, user_id=p2.id, joined_at=conv.created_at)
        db.add_all([m1, m2])
        conversations.append((conv, [p1, p2]))
    
    db.commit()

    # Create 2 group conversations
    group1_users = users[0:4]
    group2_users = users[4:8]

    g1 = Conversation(type=ConversationType.group, name="Weekend Plans", created_by=group1_users[0].id, created_at=get_random_date())
    db.add(g1)
    db.commit()
    db.refresh(g1)
    
    for i, u in enumerate(group1_users):
        role = MemberRole.admin if i == 0 else MemberRole.member
        m = ConversationMember(conversation_id=g1.id, user_id=u.id, role=role, joined_at=g1.created_at)
        db.add(m)
    
    sys_msg1 = Message(
        conversation_id=g1.id,
        body=f"{group1_users[0].display_name} created the group",
        message_type=MessageType.system,
        created_at=g1.created_at
    )
    db.add(sys_msg1)
    conversations.append((g1, group1_users))

    g2 = Conversation(type=ConversationType.group, name="Book Club", created_by=group2_users[0].id, created_at=get_random_date())
    db.add(g2)
    db.commit()
    db.refresh(g2)
    
    for i, u in enumerate(group2_users):
        role = MemberRole.admin if i == 0 else MemberRole.member
        m = ConversationMember(conversation_id=g2.id, user_id=u.id, role=role, joined_at=g2.created_at)
        db.add(m)
        
    sys_msg2 = Message(
        conversation_id=g2.id,
        body=f"{group2_users[0].display_name} created the group",
        message_type=MessageType.system,
        created_at=g2.created_at
    )
    db.add(sys_msg2)
    conversations.append((g2, group2_users))
    
    db.commit()

    message_bodies = [
        "Hey, how are you?", "Did you see the game last night?", "I'm running late!",
        "Can we reschedule?", "Sure, sounds good.", "What time?",
        "Let me know when you get this.", "Haha, that's funny.",
        "I'll call you later.", "Can you send me that link?",
        "Got it, thanks!", "Okay.", "See you soon.",
        "What's the plan for tomorrow?", "I have no idea.",
        "Let's meet at 5.", "Perfect.", "On my way."
    ]

    from app.models.models import Reaction
    emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"]
    for conv, members in conversations:
        num_msgs = random.randint(10, 30)
        base_time = conv.created_at
        
        previous_msgs = []
        for i in range(num_msgs):
            sender = random.choice(members)
            base_time = base_time + timedelta(minutes=random.randint(1, 60))
            
            reply_to_id = None
            if previous_msgs and random.random() < 0.3: # 30% chance to reply
                reply_to_id = random.choice(previous_msgs).id
                
            msg = Message(
                conversation_id=conv.id,
                sender_id=sender.id,
                body=random.choice(message_bodies),
                message_type=MessageType.text,
                created_at=base_time,
                reply_to_id=reply_to_id
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)
            previous_msgs.append(msg)
            
            # Receipts for others
            for other in members:
                if other.id != sender.id:
                    status = random.choice(list(ReceiptStatus))
                    if random.random() > 0.1:
                        receipt = MessageReceipt(
                            message_id=msg.id,
                            user_id=other.id,
                            status=status,
                            timestamp=base_time + timedelta(seconds=random.randint(5, 60))
                        )
                        db.add(receipt)
                        
            # Add reactions
            if random.random() < 0.4: # 40% chance of getting reactions
                reacters = random.sample(members, k=random.randint(1, min(3, len(members))))
                for r_user in reacters:
                    rx = Reaction(
                        message_id=msg.id,
                        user_id=r_user.id,
                        emoji=random.choice(emojis)
                    )
                    db.add(rx)
        
    db.commit()
    db.close()
    print("Database seeded successfully.")

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_db()
