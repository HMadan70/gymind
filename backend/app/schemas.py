from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    """What we expect in the request body when someone registers."""
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    """What we expect when someone logs in - either field can be
    an email or a username, we'll figure out which at login time."""
    identifier: str
    password: str


class UserResponse(BaseModel):
    """What we send back after registration - notice password_hash
    is NOT here. We never want to send hashed passwords back to the
    client, even though it's not the plaintext password."""
    id: int
    email: str
    username: str

    class Config:
        from_attributes = True  # lets this be built directly from a SQLAlchemy User object


class Token(BaseModel):
    """What we send back after a successful login."""
    access_token: str
    token_type: str = "bearer"


class UserProfileIn(BaseModel):
    goal: Optional[str] = None
    experience_level: Optional[str] = None
    injuries: Optional[str] = None
    equipment: Optional[List[str]] = None
    dietary_restrictions: Optional[List[str]] = None

class UserProfileOut(UserProfileIn):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPreferenceIn(BaseModel):
    theme_mode: Optional[str] = None
    accent_preset: Optional[str] = None

class UserPreferenceOut(UserPreferenceIn):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserWorkoutIn(BaseModel):
    ended_at: Optional[datetime] = None


class UserWorkoutOut(UserWorkoutIn):
    id: int
    user_id: int


class WorkoutSetIn(BaseModel):
    exercise_name: str
    set_number: int
    weight: float
    reps: int

class WorkoutSetOut(WorkoutSetIn):
    id: int
    workout_id: int

        