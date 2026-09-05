from pydantic import BaseModel, EmailStr, ConfigDict
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


class UserWithToken(UserResponse):
    """What we send back after registration - the same user fields as
    UserResponse, plus an access token so the frontend can skip a
    separate login call right after signup."""
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

    class Config:
        from_attributes = True


class WorkoutSetIn(BaseModel):
    exercise_id: int
    set_number: int
    weight: float
    reps: int


class WorkoutSetExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    muscle_group: str
    note: Optional[str] = None


class WorkoutSetOut(WorkoutSetIn):
    id: int
    workout_id: int
    exercise: Optional[WorkoutSetExerciseOut] = None

    class Config:
        from_attributes = True


class UserWorkoutDetail(UserWorkoutOut):
    sets: list[WorkoutSetOut] = []


class FoodIn(BaseModel):
    name: str
    calories: float
    protein: float
    carbs: float
    fat: float


class FoodOut(FoodIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fdc_id: Optional[int] = None
    user_id: Optional[int] = None



class NutritionLogIn(BaseModel):
    food_id: int
    quantity_grams: float
    logged_at: Optional[datetime] = None


class NutritionLogFoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    calories: float
    protein: float
    carbs: float
    fat: float


class NutritionLogOut(NutritionLogIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    food: Optional[NutritionLogFoodOut] = None


class BodyWeightLogIn(BaseModel):
    weight: float
    unit: str
    logged_at: Optional[datetime] = None

class BodyWeightLogOut(BodyWeightLogIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int


class NutritionTargetIn(BaseModel):
    target_calories: Optional[float] = None
    target_protein: Optional[float] = None
    target_carbs: Optional[float] = None
    target_fat: Optional[float] = None

class NutritionTargetOut(NutritionTargetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    is_manual: bool
    updated_at: datetime


class ExerciseIn(BaseModel):
    name: str
    muscle_group: str


class ExerciseOut(ExerciseIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int] = None
    is_favorited: bool = False


class FavoriteExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    exercise_id: int
    created_at: datetime


class WorkoutExerciseNoteIn(BaseModel):
    note: str


class WorkoutExerciseNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workout_id: int
    exercise_id: int
    note: str
    updated_at: datetime


class ExerciseHistorySetOut(BaseModel):
    set_number: int
    weight: Optional[float] = None
    reps: Optional[int] = None


class ExerciseHistoryOut(BaseModel):
    previous_sets: List[ExerciseHistorySetOut]
    suggested_target_weight: Optional[float] = None