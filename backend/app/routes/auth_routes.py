from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app import models, schemas, auth
from app.rate_limit import limiter

router = APIRouter()


@router.post("/auth/register", response_model=schemas.UserResponse)
@limiter.limit("5/minute")
def register(request: Request, user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check nothing already uses this email or username.
    existing = db.query(models.User).filter(
        or_(models.User.email == user_in.email, models.User.username == user_in.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    new_user = models.User(
        email=user_in.email,
        username=user_in.username,
        password_hash=auth.hash_password(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # pulls back the auto-generated id and created_at
    return new_user


@router.post("/auth/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        or_(models.User.email == credentials.identifier, models.User.username == credentials.identifier)
    ).first()

    if not user or not auth.verify_password(credentials.password, user.password_hash):
        # Deliberately vague: we don't reveal whether the email/username
        # existed at all, since that itself is information an attacker
        # could use to enumerate valid accounts.
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth.create_access_token(user.id)
    return schemas.Token(access_token=token)


@router.get("/users/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
