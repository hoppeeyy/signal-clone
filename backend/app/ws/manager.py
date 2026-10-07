from typing import Dict, Set, Any
from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.typing_tasks: Dict[str, asyncio.Task] = {} 

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        return len(self.active_connections[user_id]) == 1 

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                return True 
        return False

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_socket(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

    async def send_to_user(self, user_id: int, message: dict, exclude: WebSocket = None):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id].copy():
                if connection != exclude:
                    await self.send_to_socket(connection, message)

    async def send_to_users(self, user_ids: list[int], message: dict, exclude: WebSocket = None):
        for uid in set(user_ids):
            await self.send_to_user(uid, message, exclude)

manager = ConnectionManager()
