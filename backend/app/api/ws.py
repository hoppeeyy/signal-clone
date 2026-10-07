from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.ws.manager import manager
from app.core.config import settings
from app.models.models import User, Conversation, ConversationMember
from app.services.message_service import process_undelivered_receipts, mark_read_logic, send_message_ws_logic
from jose import jwt, JWTError
import json
import asyncio
from datetime import datetime, timezone

router = APIRouter()

def get_user_from_token(db: Session, token: str) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id:
            return db.query(User).get(int(user_id))
    except JWTError:
        return None
    return None

def get_shared_users(db: Session, user_id: int) -> list[int]:
    member_subq = db.query(ConversationMember.conversation_id).filter(ConversationMember.user_id == user_id).subquery()
    shared_members = db.query(ConversationMember.user_id).filter(ConversationMember.conversation_id.in_(member_subq)).distinct().all()
    return [m[0] for m in shared_members if m[0] != user_id]

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    db = SessionLocal()
    user = get_user_from_token(db, token)
    
    if not user:
        await websocket.close(code=4401)
        db.close()
        return

    is_first = await manager.connect(websocket, user.id)
    
    if is_first:
        user.is_online = True
        db.commit()
        
        is_visible = not (user.settings and user.settings.last_seen_visibility == 'nobody')
        if is_visible:
            shared_users = get_shared_users(db, user.id)
            presence_event = {
                "type": "presence",
                "user_id": user.id,
                "is_online": True,
                "last_seen": None
            }
            await manager.send_to_users(shared_users, presence_event, exclude=websocket)
        
        await process_undelivered_receipts(db, user.id)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue
                
            msg_type = payload.get("type")
            
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
            elif msg_type == "typing_start":
                if user.settings and not user.settings.typing_indicators:
                    continue
                conv_id = payload.get("conversation_id")
                if conv_id:
                    conv = db.query(Conversation).get(conv_id)
                    if conv and any(m.user_id == user.id for m in conv.members):
                        member_ids = [m.user_id for m in conv.members if m.user_id != user.id]
                        await manager.send_to_users(member_ids, {
                            "type": "typing",
                            "conversation_id": conv_id,
                            "user_id": user.id,
                            "is_typing": True
                        })
                        
                        task_key = f"{conv_id}:{user.id}"
                        if task_key in manager.typing_tasks:
                            manager.typing_tasks[task_key].cancel()
                            
                        async def expire_typing():
                            await asyncio.sleep(5)
                            await manager.send_to_users(member_ids, {
                                "type": "typing",
                                "conversation_id": conv_id,
                                "user_id": user.id,
                                "is_typing": False
                            })
                        manager.typing_tasks[task_key] = asyncio.create_task(expire_typing())
                        
            elif msg_type == "typing_stop":
                if user.settings and not user.settings.typing_indicators:
                    continue
                conv_id = payload.get("conversation_id")
                if conv_id:
                    conv = db.query(Conversation).get(conv_id)
                    if conv and any(m.user_id == user.id for m in conv.members):
                        member_ids = [m.user_id for m in conv.members if m.user_id != user.id]
                        await manager.send_to_users(member_ids, {
                            "type": "typing",
                            "conversation_id": conv_id,
                            "user_id": user.id,
                            "is_typing": False
                        })
                        task_key = f"{conv_id}:{user.id}"
                        if task_key in manager.typing_tasks:
                            manager.typing_tasks[task_key].cancel()
                            del manager.typing_tasks[task_key]

            elif msg_type == "send_message":
                conv_id = payload.get("conversation_id")
                body = payload.get("body")
                reply_to_id = payload.get("reply_to_id")
                client_temp_id = payload.get("client_temp_id")
                
                if conv_id and body:
                    msg_dict = await send_message_ws_logic(db, conv_id, user.id, body, reply_to_id)
                    if msg_dict:
                        if "error" in msg_dict:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "client_temp_id": client_temp_id,
                                "error": msg_dict["error"]
                            }))
                        else:
                            await websocket.send_text(json.dumps({
                                "type": "message_ack",
                                "client_temp_id": client_temp_id,
                                "message": msg_dict
                            }))
                            
            elif msg_type == "reaction.set":
                message_id = payload.get("message_id")
                emoji = payload.get("emoji")
                if message_id and emoji:
                    from app.services.message_service import add_reaction_logic
                    await add_reaction_logic(db, message_id, user.id, emoji)
                    
            elif msg_type == "reaction.remove":
                message_id = payload.get("message_id")
                if message_id:
                    from app.services.message_service import remove_reaction_logic
                    await remove_reaction_logic(db, message_id, user.id)
                        
            elif msg_type == "mark_read":
                conv_id = payload.get("conversation_id")
                if conv_id:
                    await mark_read_logic(db, conv_id, user.id)

    except WebSocketDisconnect:
        is_last = manager.disconnect(websocket, user.id)
        if is_last:
            user.is_online = False
            now = datetime.now(timezone.utc)
            user.last_seen = now
            db.commit()
            
            is_visible = not (user.settings and user.settings.last_seen_visibility == 'nobody')
            if is_visible:
                shared_users = get_shared_users(db, user.id)
                presence_event = {
                    "type": "presence",
                    "user_id": user.id,
                    "is_online": False,
                    "last_seen": now.isoformat()
                }
                await manager.send_to_users(shared_users, presence_event)
            
    finally:
        db.close()
