from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Attachment, AttachmentKind
from app.api.deps import get_current_user
from app.schemas.schemas import AttachmentRead
from app.storage import get_storage
from app.core.config import settings
from PIL import Image
import io
import os

router = APIRouter(prefix="/attachments", tags=["attachments"])

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
ALLOWED_FILE_TYPES = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"]

MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_FILE_SIZE = 10 * 1024 * 1024

@router.post("", response_model=AttachmentRead)
async def upload_attachment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import filetype

    content = await file.read()
    size = len(content)
    
    declared_mime = file.content_type
    
    kind_guess = filetype.guess(content)
    if kind_guess:
        sniffed_mime = kind_guess.mime
    else:
        try:
            content.decode('utf-8')
            sniffed_mime = 'text/plain'
        except UnicodeDecodeError:
            sniffed_mime = 'application/octet-stream'
            
    # For docx/xlsx, filetype detects application/zip. Allow it if declared mime is docx/xlsx.
    if sniffed_mime == "application/zip" and declared_mime in ALLOWED_FILE_TYPES:
        mime = declared_mime
    elif sniffed_mime == declared_mime:
        mime = sniffed_mime
    elif sniffed_mime == "text/plain" and declared_mime == "text/plain":
        mime = sniffed_mime
    else:
        raise HTTPException(status_code=400, detail="File content does not match declared MIME type")
    
    if mime in ALLOWED_IMAGE_TYPES:
        if size > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Image size exceeds 5MB limit")
        kind = AttachmentKind.image
    elif mime in ALLOWED_FILE_TYPES:
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        kind = AttachmentKind.file
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    width = None
    height = None
    if kind == AttachmentKind.image:
        try:
            with Image.open(io.BytesIO(content)) as img:
                width, height = img.size
        except Exception:
            pass

    storage = get_storage()
    file.file.seek(0)
    result = storage.save(io.BytesIO(content), file.filename)
    
    attachment = Attachment(
        uploader_id=current_user.id,
        storage_key=result["storage_key"],
        original_name=file.filename,
        mime_type=mime,
        size_bytes=size,
        width=width,
        height=height,
        kind=kind
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return {
        "id": attachment.id,
        "message_id": attachment.message_id,
        "uploader_id": attachment.uploader_id,
        "original_name": attachment.original_name,
        "mime_type": attachment.mime_type,
        "size_bytes": attachment.size_bytes,
        "width": attachment.width,
        "height": attachment.height,
        "kind": attachment.kind.value,
        "url": result["url"]
    }

@router.get("/{id}/file")
def get_attachment_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attachment = db.query(Attachment).get(id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    if attachment.message_id is None:
        if attachment.uploader_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        # Check if user is member of conversation
        from app.models.models import ConversationMember
        member = db.query(ConversationMember).filter_by(
            conversation_id=attachment.message.conversation_id,
            user_id=current_user.id
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    storage = get_storage()
    file_obj = storage.open(attachment.storage_key)
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found on storage")
        
    content_disp = "inline" if attachment.kind == AttachmentKind.image else f'attachment; filename="{attachment.original_name}"'
    
    return Response(
        content=file_obj.read(),
        media_type=attachment.mime_type,
        headers={
            "Content-Disposition": content_disp,
            "Cache-Control": "public, max-age=31536000"
        }
    )

@router.delete("/{id}")
def delete_unattached_attachment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attachment = db.query(Attachment).get(id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    if attachment.message_id is not None:
        raise HTTPException(status_code=400, detail="Cannot delete an attached file directly")
        
    if attachment.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    storage = get_storage()
    storage.delete(attachment.storage_key)
    
    db.delete(attachment)
    db.commit()
    
    return {"status": "ok"}
