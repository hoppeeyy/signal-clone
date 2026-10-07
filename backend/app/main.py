from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.core.database import Base, engine
from app.seed import seed_db

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.contacts import router as contacts_router
from app.api.conversations import router as conversations_router
from app.api.messages import router as messages_router
from app.api.ws import router as ws_router
from app.api.attachments import router as attachments_router
import asyncio
from datetime import datetime, timedelta, timezone
from app.models.models import Attachment
from app.storage import get_storage

async def cleanup_unattached_attachments():
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        old_attachments = db.query(Attachment).filter(
            Attachment.message_id == None,
            Attachment.created_at < cutoff
        ).all()
        storage = get_storage()
        for att in old_attachments:
            storage.delete(att.storage_key)
            db.delete(att)
        db.commit()
    except Exception as e:
        print(f"Cleanup error: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_db()
    os.makedirs("uploads/avatars", exist_ok=True)
    asyncio.create_task(cleanup_unattached_attachments())
    yield

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(contacts_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(attachments_router)
app.include_router(ws_router)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
