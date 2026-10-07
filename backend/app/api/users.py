import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, UserSettings
from app.schemas.schemas import UserRead, UserUpdate, UserSettingsRead, UserSettingsUpdate
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.put("/me", response_model=UserRead)
def update_me(data: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.about is not None:
        current_user.about = data.about
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/me/settings", response_model=UserSettingsRead)
def get_my_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.patch("/me/settings", response_model=UserSettingsRead)
def update_my_settings(data: UserSettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
    
    update_data = data.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(settings, k, v)
        
    db.commit()
    db.refresh(settings)
    return settings

@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    
    from app.core.config import settings
    upload_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = f"{upload_dir}/{current_user.id}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(contents)
    
    current_user.avatar_url = f"/uploads/avatars/{current_user.id}_{file.filename}"
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/search", response_model=list[UserRead])
def search_users(q: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(User).filter(
        (User.id != current_user.id) & 
        (
            (User.display_name.ilike(f"%{q}%")) | 
            (User.phone_number.ilike(f"%{q}%")) | 
            (User.username.ilike(f"%{q}%"))
        )
    ).limit(20).all()
    return users
