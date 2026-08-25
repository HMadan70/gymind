from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter()


@router.get("/users/profile", response_model=schemas.UserProfileOut)
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


@router.post("/users/profile", response_model=schemas.UserProfileOut)
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


# NOTE: these two routes now require a completed profile (auth.require_profile),
# not just a valid login (auth.get_current_user). A user with no user_profiles
# row will get a 403 here instead of being able to set their theme before
# finishing onboarding. See PROJECT_STATUS.md, Section 11 (onboarding gate).
@router.get("/users/preferences", response_model=schemas.UserPreferenceOut)
def get_preferences(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    preferences = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id
    ).first()
    if not preferences:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return preferences


@router.post("/users/preferences", response_model=schemas.UserPreferenceOut)
def upsert_preferences(
    preferences_in: schemas.UserPreferenceIn,
    current_user: models.User = Depends(auth.require_profile),
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


@router.get("/users/onboarding-check")
def onboarding_check(current_user: models.User = Depends(auth.require_profile)):
    return {"status": "profile complete", "user_id": current_user.id}
