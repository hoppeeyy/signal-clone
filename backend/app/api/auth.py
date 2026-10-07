from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import RequestOTP, VerifyOTP, Token, UserRead
from app.core.security import create_access_token
from app.models.models import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/request-otp")
def request_otp(data: RequestOTP):
    # Mocked: always succeeds, OTP is fixed
    print(f"OTP for {data.identifier} is 123456")
    return {"message": "OTP sent successfully"}

@router.post("/verify-otp", response_model=Token)
def verify_otp(data: VerifyOTP, db: Session = Depends(get_db)):
    if data.otp != "123456":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")
    
    user = db.query(User).filter(
        (User.phone_number == data.identifier) | (User.username == data.identifier)
    ).first()
    
    is_new = False
    if not user:
        user = User(
            phone_number=data.identifier, 
            display_name=f"User {data.identifier[-4:]}"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True
        
    access_token = create_access_token(subject=str(user.id))
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "is_new_user": is_new
    }

@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout():
    return {"message": "Successfully logged out"}
