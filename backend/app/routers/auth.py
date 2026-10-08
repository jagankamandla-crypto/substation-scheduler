from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.present import present_user
from app.schemas import LoginIn
from app.security import create_token, verify_password

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is not recognised.")
    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": present_user(user),
    }


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return present_user(user)
