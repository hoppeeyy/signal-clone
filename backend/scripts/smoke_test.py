import httpx

API_URL = "http://localhost:8001"

def main():
    print("Running Smoke Test...")
    
    with httpx.Client(base_url=API_URL) as client:
        # 1. Login
        print("\n[1] Testing Auth...")
        phone = "+1234567890" # Seeding creates this user
        client.post("/api/auth/request-otp", json={"identifier": phone})
        res = client.post("/api/auth/verify-otp", json={"identifier": phone, "otp": "123456"})
        if res.status_code == 200:
            token = res.json()["access_token"]
            client.headers.update({"Authorization": f"Bearer {token}"})
            print("[PASS]: Login successful")
        else:
            print(f"[FAIL]: Login failed {res.text}")
            return
            
        # 2. List Conversations
        print("\n[2] Testing Conversations...")
        res = client.get("/api/conversations")
        if res.status_code == 200:
            convs = res.json()
            print(f"[PASS]: Fetched {len(convs)} conversations")
        else:
            print(f"[FAIL]: List conversations failed {res.text}")
            
        # 3. Open one conversation
        conv_id = convs[0]["id"]
        res = client.get(f"/api/conversations/{conv_id}")
        if res.status_code == 200:
            print("[PASS]: Fetched conversation details")
        else:
            print(f"[FAIL]: Conversation details failed {res.text}")
            
        # 4. Send a message
        print("\n[3] Testing Messages...")
        res = client.post(f"/api/conversations/{conv_id}/messages", json={"body": "Smoke test message!"})
        if res.status_code == 200:
            print("[PASS]: Sent message")
        else:
            print(f"[FAIL]: Send message failed {res.text}")
            
        # 5. Mark as read
        res = client.post(f"/api/conversations/{conv_id}/read")
        if res.status_code == 200:
            print("[PASS]: Marked messages as read")
        else:
            print(f"[FAIL]: Mark read failed {res.text}")
            
        # 6. Create a group
        print("\n[4] Testing Group Management...")
        res = client.post("/api/conversations/group", json={
            "name": "Smoke Test Group",
            "member_ids": [2, 3] # assuming users 2 and 3 exist
        })
        if res.status_code == 200:
            group_id = res.json()["id"]
            print("[PASS]: Created group")
        else:
            print(f"[FAIL]: Create group failed {res.text}")
            return
            
        # 7. Add member
        res = client.post(f"/api/conversations/{group_id}/members", json={"user_id": 4})
        if res.status_code == 200:
            print("[PASS]: Added member to group")
        else:
            print(f"[FAIL]: Add member failed {res.text}")
            
        # 8. Remove member
        res = client.delete(f"/api/conversations/{group_id}/members/4")
        if res.status_code == 200:
            print("[PASS]: Removed member from group")
        else:
            print(f"[FAIL]: Remove member failed {res.text}")

if __name__ == "__main__":
    main()
