import os
import uuid
import shutil
from typing import Dict, Any, Optional
from app.core.config import settings

class StorageBackend:
    def save(self, file_obj, filename: str) -> Dict[str, Any]:
        raise NotImplementedError

    def delete(self, key: str):
        raise NotImplementedError

    def open(self, key: str):
        raise NotImplementedError

class LocalDiskStorage(StorageBackend):
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(os.path.join(self.upload_dir, "attachments"), exist_ok=True)

    def save(self, file_obj, filename: str) -> Dict[str, Any]:
        ext = os.path.splitext(filename)[1]
        key = f"attachments/{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(self.upload_dir, key)
        
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file_obj, f)
            
        url = f"{settings.PUBLIC_API_URL}/{settings.UPLOAD_DIR}/{key}"
        return {"storage_key": key, "url": url}

    def delete(self, key: str):
        filepath = os.path.join(self.upload_dir, key)
        if os.path.exists(filepath):
            os.remove(filepath)

    def open(self, key: str):
        filepath = os.path.join(self.upload_dir, key)
        if os.path.exists(filepath):
            return open(filepath, "rb")
        return None

class CloudinaryStorage(StorageBackend):
    def save(self, file_obj, filename: str) -> Dict[str, Any]:
        # Stub for Cloudinary
        raise NotImplementedError("Cloudinary storage is not implemented yet")

    def delete(self, key: str):
        pass

    def open(self, key: str):
        return None

def get_storage() -> StorageBackend:
    if settings.STORAGE_BACKEND == "cloudinary":
        return CloudinaryStorage()
    return LocalDiskStorage()
