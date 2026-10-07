# ?? Signal Clone

A full-stack, real-time messaging application inspired by Signal — built with **Next.js 14**, **FastAPI**, and **WebSockets**. Supports end-to-end encrypted-style UX, group chats, file/image attachments, read receipts, reactions, typing indicators, presence, and more.

> **Live repo:** [https://github.com/hoppeeyy/signal-clone](https://github.com/hoppeeyy/signal-clone)

---

## ? Feature Highlights

| Feature | Status |
|---|---|
| Phone/username login with OTP | ? |
| JWT authentication | ? |
| Real-time messaging via WebSocket | ? |
| Direct (1-on-1) chats | ? |
| Group chats (create, add/remove/leave members) | ? |
| Image & file attachments (upload via REST, referenced in message) | ? |
| Message read receipts (sent ? delivered ? read) | ? |
| Reply-to / quote messages | ? |
| Emoji reactions with per-user breakdown | ? |
| Typing indicators | ? |
| Online presence & last seen | ? |
| Mute conversations | ? |
| Delete messages (for me / for everyone) | ? |
| Safety number verification | ? |
| Contact management (save from chat, search) | ? |
| Avatar upload from device | ? |
| Group system notifications (added/removed/left/renamed) | ? |
| Dark / light / system theme | ? |
| Privacy settings (read receipts, typing, last seen) | ? |
| Local disk storage for uploads (pluggable to Cloudinary) | ? |
| Responsive mobile-first layout | ? |

---

## ??? Architecture

```
signal-clone/
+-- frontend/          # Next.js 14 app (App Router)
¦   +-- src/
¦   ¦   +-- app/       # Pages & layouts
¦   ¦   +-- components/# UI components (chat, modals, sidebar)
¦   ¦   +-- hooks/     # useRealtime (WebSocket), custom hooks
¦   ¦   +-- store/     # Zustand stores (auth, messages, chats, presence…)
¦   ¦   +-- lib/       # fetchApi helper, types
¦   +-- .env.local     # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
¦
+-- backend/           # FastAPI (Python)
¦   +-- app/
¦   ¦   +-- api/       # REST routers (auth, conversations, messages, attachments…)
¦   ¦   +-- models/    # SQLAlchemy ORM models
¦   ¦   +-- schemas/   # Pydantic request/response schemas
¦   ¦   +-- services/  # Business logic (message, conversation, storage)
¦   ¦   +-- storage/   # Pluggable storage (LocalDiskStorage / Cloudinary stub)
¦   ¦   +-- ws/        # WebSocket connection manager
¦   ¦   +-- core/      # Config, database session
¦   +-- scripts/       # smoke_test.py, ws_test.py
¦   +-- .env           # SECRET_KEY, STORAGE_BACKEND, DATABASE_URL…
¦
+-- docs/              # Schema, WS spec, UI spec
```

### Communication Flow

```
Browser --REST--? FastAPI /api/*   (auth, CRUD, file upload)
Browser --WS--?  FastAPI /ws/      (real-time events)
FastAPI --?  SQLite (dev) / PostgreSQL (prod)
FastAPI --?  uploads/ (LocalDisk) or Cloudinary
```

> **Files never travel over WebSocket.** Attachments are uploaded via `POST /api/attachments/upload` first, then the returned `attachment_id` is referenced in the message payload.

---

## ?? Getting Started

### Prerequisites

- **Node.js** = 18
- **Python** = 3.11
- **Git**

---

### 1. Clone the repo

```bash
git clone https://github.com/hoppeeyy/signal-clone.git
cd signal-clone
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file
cp .env.example .env
# Edit .env and set SECRET_KEY at minimum
```

**`backend/.env` values:**

```env
SECRET_KEY=your-random-secret-key-here
DATABASE_URL=sqlite:///./signal_clone.db
STORAGE_BACKEND=local
UPLOAD_DIR=uploads
BASE_URL=http://localhost:8001
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```

**Start the backend:**

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

The server auto-creates the SQLite database and seeds demo users on first start.  
Seeding is **idempotent** — restarting never duplicates data.

?? Interactive API docs: [http://localhost:8001/docs](http://localhost:8001/docs)

---

### 3. Frontend Setup

```bash
cd frontend

npm install

cp .env.example .env.local
# Edit .env.local
```

**`frontend/.env.local` values:**

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

**Start the frontend:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) ??

---

## ?? Authentication

The app uses **phone number or username + OTP** login.

1. Enter your phone number (e.g. `+1234567890`) or username
2. The OTP is printed to the **backend console** (dev mode)
3. Enter the OTP to receive a JWT token, stored in `localStorage`

All API requests use `Authorization: Bearer <token>`.

---

## ?? WebSocket Protocol

The frontend maintains a single persistent WebSocket connection at `/ws?token=<jwt>`.

| Event | Direction | Payload |
|---|---|---|
| `new_message` | server ? client | Full message object |
| `message_updated` | server ? client | Updated message (reactions, delete) |
| `receipt_update` | server ? client | `{ message_id, user_id, status }` |
| `typing` | client ? server | `{ conversation_id, is_typing }` |
| `typing_indicator` | server ? client | `{ conversation_id, user_id, is_typing }` |
| `presence_update` | server ? client | `{ user_id, is_online, last_seen }` |
| `conversation_updated` | server ? client | Group renamed, avatar changed |
| `group.member_added` | server ? client | `{ conversation_id, added_user_ids }` |
| `group.member_removed` | server ? client | `{ conversation_id, removed_user_id }` |

---

## ?? Attachment System

```
1. Client: POST /api/attachments/upload (multipart/form-data)
           ? { id, url, kind, mime_type, size_bytes, ... }

2. Client: POST /api/conversations/{id}/messages
           Body: { body: "Look at this!", attachment_ids: [42] }
```

- **`local`** — files saved to `backend/uploads/`, served at `/uploads/<key>`  
- **`cloudinary`** — stub in `backend/app/storage/cloudinary_storage.py`  
- Switch backends via `STORAGE_BACKEND=local|cloudinary` in `.env`

---

## ??? Database Schema

| Table | Description |
|---|---|
| `users` | Accounts (phone, username, display name, avatar) |
| `user_settings` | Privacy & notification preferences per user |
| `conversations` | Direct and group conversations |
| `conversation_members` | Membership, role (admin/member), mute, last_read |
| `messages` | All messages — text, system, attachment |
| `message_receipts` | Per-user delivery and read timestamps |
| `reactions` | Emoji reactions with user references |
| `attachments` | Uploaded files linked to messages |
| `contacts` | User address book entries |

---

## ?? Testing

### Backend

```bash
cd backend
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# REST endpoint smoke test
python scripts/smoke_test.py

# WebSocket event test
python scripts/ws_test.py
```

### Frontend

```bash
cd frontend
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
npm run build         # Production build (catches all errors)
```

---

## ?? Design System

- **Framework:** Next.js 14 App Router + React 18
- **Styling:** Tailwind CSS + custom CSS variables
- **State management:** Zustand
- **Icons:** Lucide React
- **Animations:** `tailwindcss-animate`

### CSS Theme Tokens (`globals.css`)

| Token | Purpose |
|---|---|
| `--theme-primary` | Accent / brand color |
| `--theme-app` | Main background |
| `--theme-text` | Primary text |
| `--theme-text-secondary` | Muted / secondary text |
| `--theme-border` | Border / divider color |
| `--theme-input` | Input field background |
| `--theme-online` | Online presence indicator |

---

## ?? Key Source Files

| File | Purpose |
|---|---|
| `frontend/src/hooks/useRealtime.ts` | WS listener — dispatches all real-time events to Zustand stores |
| `frontend/src/store/messages.ts` | Per-conversation message state, optimistic updates |
| `frontend/src/store/chats.ts` | Sidebar conversation list |
| `frontend/src/store/presence.ts` | Online/offline status map |
| `frontend/src/components/chat/MessageBubble.tsx` | Renders text, image, file, and system messages |
| `frontend/src/components/chat/Composer.tsx` | Input bar with attachment picker and emoji |
| `frontend/src/components/chat/ChatHeader.tsx` | Header with contact info, save contact, mute, group info |
| `frontend/src/components/SettingsModal.tsx` | Profile (avatar upload), appearance, privacy, notifications |
| `backend/app/api/conversations.py` | Group CRUD — create, add/remove members, system messages |
| `backend/app/api/messages.py` | Message send, receipts, reactions, delete |
| `backend/app/api/attachments.py` | File upload endpoint |
| `backend/app/storage/local_storage.py` | Local disk storage implementation |
| `backend/app/ws/manager.py` | WebSocket connection manager, per-user routing |

---

## ?? Configuration Reference

### Backend `.env`

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(required)* | JWT signing secret |
| `DATABASE_URL` | `sqlite:///./signal_clone.db` | SQLAlchemy DB URL |
| `STORAGE_BACKEND` | `local` | `local` or `cloudinary` |
| `UPLOAD_DIR` | `uploads` | Local upload directory |
| `BASE_URL` | `http://localhost:8001` | Base URL for attachment URLs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `43200` (30 days) | JWT lifetime |

### Frontend `.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001` | Backend REST base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8001` | Backend WebSocket URL |

---

## ?? Deployment

1. **Database:** Use `DATABASE_URL=postgresql://...` for production
2. **Storage:** Set `STORAGE_BACKEND=cloudinary` and add credentials to `.env`
3. **CORS:** Update `allow_origins` in `backend/app/main.py` to your domain
4. **HTTPS:** Use `wss://` in `NEXT_PUBLIC_WS_URL` in production
5. **Frontend build:** `npm run build && npm start`

---

## ?? Contributing

```bash
# 1. Fork & clone
git checkout -b feature/your-feature

# 2. Make changes & test
npm run lint && npm run build   # frontend
python scripts/smoke_test.py    # backend

# 3. Push & open PR
git push origin feature/your-feature
```

---

## ?? License

MIT © 2024 hoppeeyy

---

## ?? Acknowledgements

- [Signal](https://signal.org) — original design inspiration
- [FastAPI](https://fastapi.tiangolo.com) — Python web framework
- [Next.js](https://nextjs.org) — React framework
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling
- [Lucide](https://lucide.dev) — icons
