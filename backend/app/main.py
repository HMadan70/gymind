
import os
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy import or_
 
from app.database import Base, engine, get_db
from app import models, schemas, auth
 
app = FastAPI(title="Gymind API")
 
# Creates any tables defined in models.py that don't already exist yet.
# This is fine for early development - once the schema stabilizes and
# you have real data you care about, you'd switch to a migration tool
# (Alembic) instead of relying on this, since create_all() never alters
# or drops existing columns, only adds brand-new tables.
Base.metadata.create_all(bind=engine)
 
DATABASE_URL = os.getenv("DATABASE_URL")
health_engine = create_engine(DATABASE_URL) if DATABASE_URL else None
 
 
@app.get("/")
def root():
    return {"message": "Gymind API is running"}
 
 
@app.get("/health")
def health_check():
    return {"status": "ok"}
 
 
@app.get("/health/db")
def db_health_check():
    if health_engine is None:
        return {"status": "error", "detail": "DATABASE_URL not set"}
    try:
        with health_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
 
 
@app.post("/auth/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
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
 
 
@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
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
 
 
@app.get("/users/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
 
 
@app.get("/users/profile", response_model=schemas.UserProfileOut)
def get_profile(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile
 
 
@app.post("/users/profile", response_model=schemas.UserProfileOut)
def upsert_profile(
    profile_in: schemas.UserProfileIn,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.user_id == current_user.id
    ).first()
 
    if profile:
        for field, value in profile_in.dict(exclude_unset=True).items():
            setattr(profile, field, value)
    else:
        profile = models.UserProfile(user_id=current_user.id, **profile_in.dict())
        db.add(profile)
 
    db.commit()
    db.refresh(profile)
    return profile
 
 
@app.get("/users/preferences", response_model=schemas.UserPreferenceOut)
def get_preferences(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    preferences = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id
    ).first()
    if not preferences:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return preferences
 
 
@app.post("/users/preferences", response_model=schemas.UserPreferenceOut)
def upsert_preferences(
    preferences_in: schemas.UserPreferenceIn,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    preferences = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id
    ).first()
 
    if preferences:
        for field, value in preferences_in.dict(exclude_unset=True).items():
            setattr(preferences, field, value)
    else:
        preferences = models.UserPreference(user_id=current_user.id, **preferences_in.dict())
        db.add(preferences)
 
    db.commit()
    db.refresh(preferences)
    return preferences
 