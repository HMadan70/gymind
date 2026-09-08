from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Literal, Optional
from datetime import datetime


class UserCreate(BaseModel):
    """What we expect in the request body when someone registers."""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    """What we expect when someone logs in - either field can be
    an email or a username, we'll figure out which at login time."""
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    """What we send back after registration - notice password_hash
    is NOT here. We never want to send hashed passwords back to the
    client, even though it's not the plaintext password."""
    id: int
    email: str
    username: str

    model_config = ConfigDict(from_attributes=True)


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
    goal: Optional[str] = Field(default=None, max_length=100)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    injuries: Optional[str] = Field(default=None, max_length=2_000)
    equipment: Optional[list[str]] = Field(default=None, max_length=50)
    dietary_restrictions: Optional[list[str]] = Field(default=None, max_length=50)

class UserProfileOut(UserProfileIn):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPreferenceIn(BaseModel):
    theme_mode: Optional[Literal["dark", "light"]] = None

class UserPreferenceOut(UserPreferenceIn):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserWorkoutIn(BaseModel):
    ended_at: Optional[datetime] = None


class UserWorkoutOut(UserWorkoutIn):
    id: int
    user_id: int
    started_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkoutSetIn(BaseModel):
    exercise_id: int = Field(gt=0)
    set_number: int = Field(gt=0, le=100)
    weight: float = Field(gt=0, le=2_000)
    reps: int = Field(gt=0, le=1_000)


class WorkoutSetUpdate(BaseModel):
    """
    Edit payload for an already-logged set. Only weight/reps are
    editable — moving a set to a different exercise or renumbering it
    is a different operation, not a correction of what was lifted.
    """
    weight: float = Field(gt=0, le=2_000)
    reps: int = Field(gt=0, le=1_000)


class WorkoutSetExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    muscle_group: str
    note: Optional[str] = None


class WorkoutSetOut(WorkoutSetIn):
    id: int
    workout_id: int
    exercise: Optional[WorkoutSetExerciseOut] = None

    model_config = ConfigDict(from_attributes=True)


class UserWorkoutDetail(UserWorkoutOut):
    sets: list[WorkoutSetOut] = Field(default_factory=list)


class FoodIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    calories: float = Field(ge=0, le=10_000)
    protein: float = Field(ge=0, le=1_000)
    carbs: float = Field(ge=0, le=1_000)
    fat: float = Field(ge=0, le=1_000)

    @field_validator("name")
    @classmethod
    def strip_food_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Food name cannot be blank")
        return value


class FoodOut(FoodIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fdc_id: Optional[int] = None
    user_id: Optional[int] = None
    # Computed per-request via an outer join, never stored on foods —
    # same as ExerciseOut.is_favorited.
    is_favorited: bool = False


class FavoriteFoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    food_id: int
    created_at: datetime



class NutritionLogIn(BaseModel):
    food_id: int = Field(gt=0)
    quantity_grams: float = Field(gt=0, le=100_000)
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
    weight: float = Field(gt=0, le=2_000)
    unit: Literal["lb", "kg"]
    logged_at: Optional[datetime] = None

class BodyWeightLogOut(BodyWeightLogIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int


class NutritionTargetIn(BaseModel):
    target_calories: Optional[float] = Field(default=None, ge=0, le=20_000)
    target_protein: Optional[float] = Field(default=None, ge=0, le=2_000)
    target_carbs: Optional[float] = Field(default=None, ge=0, le=2_000)
    target_fat: Optional[float] = Field(default=None, ge=0, le=2_000)

class NutritionTargetOut(NutritionTargetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    is_manual: bool
    updated_at: datetime


class ExerciseIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    muscle_group: str = Field(min_length=1, max_length=100)

    @field_validator("name", "muscle_group")
    @classmethod
    def strip_exercise_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


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
    note: str = Field(max_length=2_000)


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
    previous_sets: list[ExerciseHistorySetOut]
    suggested_target_weight: Optional[float] = None
