import asyncio
import httpx
import websockets
import json
import uuid

API_URL = "http://localhost:8001/api"
WS_URL = "ws://localhost:8001/ws"

def get_token(identifier: str) -> str:
    with httpx.Client(base_url=API_URL) as client:
        client.post("/auth/request-otp", json={"identifier": identifier})
        res = client.post("/auth/verify-otp", json={"identifier": identifier, "otp": "123456"})
        if res.status_code == 200:
            return res.json()["access_token"]
        raise Exception(f"Failed to login {identifier}")

def get_conversation_between(token_a: str, user_id_b: int) -> int:
    with httpx.Client(base_url=API_URL, headers={"Authorization": f"Bearer {token_a}"}) as client:
        res = client.post("/conversations/direct", json={"user_id": user_id_b})
        if res.status_code == 200:
            return res.json()["id"]
        raise Exception("Failed to get direct conversation")

async def test_websockets():
    print("Running WebSocket Test...")
    
    # 1. Login
    print("\n[1] Logging in users...")
    token_a = get_token("+1234567890")
    token_b = get_token("+1234567891")
    print("[PASS]: Got tokens for A and B")
    
    conv_id = get_conversation_between(token_a, 2) # User B has ID 2
    
    # 2. Connect
    print("\n[2] Connecting WebSockets...")
    async with websockets.connect(f"{WS_URL}?token={token_a}") as ws_a:
        async with websockets.connect(f"{WS_URL}?token={token_b}") as ws_b:
            print("[PASS]: Connected A and B")
            
            await asyncio.sleep(0.5)
            
            # Flush existing presence events or unread receipts
            async def flush_ws(ws):
                while True:
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=0.1)
                    except asyncio.TimeoutError:
                        break
                        
            await flush_ws(ws_a)
            await flush_ws(ws_b)
                
            # 3. Typing event
            print("\n[3] Testing Typing Event...")
            await ws_a.send(json.dumps({"type": "typing_start", "conversation_id": conv_id}))
            
            # Wait for B to receive typing
            typing_received = False
            for _ in range(5):
                try:
                    data = await asyncio.wait_for(ws_b.recv(), timeout=1.0)
                    evt = json.loads(data)
                    if evt.get("type") == "typing" and evt.get("is_typing") is True:
                        typing_received = True
                        break
                except asyncio.TimeoutError:
                    pass
                    
            if typing_received:
                print("[PASS]: User B received typing_start from A")
            else:
                print("[FAIL]: User B did not receive typing_start")
                
            # 4. Send Message
            print("\n[4] Testing Message Sending & Delivery...")
            temp_id = str(uuid.uuid4())
            await ws_a.send(json.dumps({
                "type": "send_message",
                "conversation_id": conv_id,
                "body": "Hello over WS!",
                "client_temp_id": temp_id
            }))
            
            # A should receive message_ack
            ack_received = False
            msg_id = None
            delivered_received = False
            for _ in range(5):
                try:
                    data = await asyncio.wait_for(ws_a.recv(), timeout=1.0)
                    evt = json.loads(data)
                    if evt.get("type") == "message_ack" and evt.get("client_temp_id") == temp_id:
                        ack_received = True
                        msg_id = evt["message"]["id"]
                        if evt["message"].get("status") == "delivered":
                            delivered_received = True
                        break
                except asyncio.TimeoutError:
                    pass
                    
            if ack_received:
                print("[PASS]: User A received message_ack")
            else:
                print("[FAIL]: User A did not receive message_ack")
                
            if delivered_received:
                print("[PASS]: User A received message_status 'delivered' inside ack")
            else:
                print("[FAIL]: User A did not receive message_status 'delivered'")
                
            # B should receive new_message
            msg_received = False
            for _ in range(5):
                try:
                    data = await asyncio.wait_for(ws_b.recv(), timeout=1.0)
                    evt = json.loads(data)
                    if evt.get("type") == "new_message" and evt["message"].get("body") == "Hello over WS!":
                        msg_received = True
                        break
                except asyncio.TimeoutError:
                    pass
                    
            if msg_received:
                print("[PASS]: User B received new_message")
            else:
                print("[FAIL]: User B did not receive new_message")
                
            # 5. Mark Read
            print("\n[5] Testing Read Receipts...")
            await ws_b.send(json.dumps({"type": "mark_read", "conversation_id": conv_id}))
            
            read_received = False
            for _ in range(5):
                try:
                    data = await asyncio.wait_for(ws_a.recv(), timeout=1.0)
                    evt = json.loads(data)
                    if evt.get("type") == "message_status" and evt.get("message_id") == msg_id and evt.get("status") == "read":
                        read_received = True
                        break
                except asyncio.TimeoutError:
                    pass
                    
            if read_received:
                print("[PASS]: User A received message_status 'read'")
            else:
                print("[FAIL]: User A did not receive message_status 'read'")
                
            print("\nAll WS tests completed!")

if __name__ == "__main__":
    asyncio.run(test_websockets())
