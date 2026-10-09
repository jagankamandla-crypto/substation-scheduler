from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.domain import (
    EMAIL_INVALID,
    EMAIL_TAKEN,
    EMAIL_UNKNOWN,
    PASSWORD_MIN,
    PASSWORD_SHORT,
    PERSON_NAME_REQUIRED,
    ROLE_REQUIRED,
    ROLES,
    RuleError,
    clean_email,
    email_ok,
)
from app.models import User
from app.present import present_user
from app.schemas import LoginIn, RegisterIn, ResetPasswordIn
from app.security import create_token, hash_password, verify_password

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is not recognised.")
    return _session(user)


def _session(user: User) -> dict:
    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": present_user(user),
    }


def _find_user(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email))


@router.post("/auth/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    errors: list[tuple[str, str]] = []
    name = body.full_name.strip()
    email = clean_email(body.email)
    if not name:
        errors.append(("full_name", PERSON_NAME_REQUIRED))
    if not email_ok(email):
        errors.append(("email", EMAIL_INVALID))
    elif _find_user(db, email) is not None:
        errors.append(("email", EMAIL_TAKEN))
    if body.role not in ROLES:
        errors.append(("role", ROLE_REQUIRED))
    if len(body.password) < PASSWORD_MIN:
        errors.append(("password", PASSWORD_SHORT))
    if errors:
        raise RuleError(errors)
    user = User(email=email, full_name=name, role=body.role, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _session(user)


@router.post("/auth/reset-password")
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    errors: list[tuple[str, str]] = []
    email = clean_email(body.email)
    if not email_ok(email):
        errors.append(("email", EMAIL_INVALID))
    if len(body.password) < PASSWORD_MIN:
        errors.append(("password", PASSWORD_SHORT))
    user = _find_user(db, email) if email_ok(email) else None
    if email_ok(email) and user is None:
        errors.append(("email", EMAIL_UNKNOWN))
    if errors:
        raise RuleError(errors)
    assert user is not None
    user.password_hash = hash_password(body.password)
    db.commit()
    return {"detail": "Password updated. Sign in with the new password."}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return present_user(user)
