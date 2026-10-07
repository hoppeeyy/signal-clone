from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Contact
from app.schemas.schemas import ContactCreate, ContactRead
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/contacts", tags=["contacts"])

@router.get("", response_model=list[ContactRead])
def get_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return current_user.contacts

@router.post("", response_model=ContactRead)
def add_contact(data: ContactCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact_user = None
    
    # Try by numeric user_id first (sent from chat header)
    if data.identifier.isdigit():
        contact_user = db.query(User).filter(User.id == int(data.identifier)).first()
    
    # Fall back to phone/username
    if not contact_user:
        contact_user = db.query(User).filter(
            (User.phone_number == data.identifier) | (User.username == data.identifier)
        ).first()
    
    if not contact_user:
        raise HTTPException(status_code=404, detail="User not found")
    if contact_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add self as contact")
    
    existing = db.query(Contact).filter_by(owner_id=current_user.id, contact_user_id=contact_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contact already exists")
    
    new_contact = Contact(
        owner_id=current_user.id,
        contact_user_id=contact_user.id,
        nickname=data.nickname or contact_user.display_name
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.delete("/{contact_id}")
def delete_contact(contact_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter_by(id=contact_id, owner_id=current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}
