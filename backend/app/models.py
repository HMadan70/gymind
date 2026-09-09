from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, ARRAY, DateTime, Boolean, false, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    goal = Column(Text, nullable=True)
    experience_level = Column(Text, nullable=True)
    injuries = Column(Text, nullable=True)
    equipment = Column(ARRAY(Text), nullable=True)
    dietary_restrictions = Column(ARRAY(Text), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserWorkout(Base):
    __tablename__ = "user_workouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    theme_mode = Column(Text, nullable=True)      # "dark" or "light"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    muscle_group = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class UserFavoriteExercise(Base):
    __tablename__ = "user_favorite_exercises"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_user_favorite_exercises_user_exercise"),
    )


class WorkoutExerciseNote(Base):
    __tablename__ = "workout_exercise_notes"

    id = Column(Integer, primary_key=True, index=True)
    workout_id = Column(Integer, ForeignKey("user_workouts.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    note = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("workout_id", "exercise_id", name="uq_workout_exercise_notes_workout_exercise"),
    )


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id = Column(Integer, primary_key=True, index=True)
    workout_id = Column(Integer, ForeignKey("user_workouts.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    set_number = Column(Integer, nullable=False)
    weight = Column(Float, nullable=True)
    reps = Column(Integer, nullable=True)


class UserFavoriteFood(Base):
    """
    Per-user food favourites. Deliberately a join table rather than an
    is_favorite column on foods: foods is shared (user_id IS NULL rows are
    the USDA reference set), so a column there would make one user's
    favourite visible to everyone. Exact mirror of UserFavoriteExercise.
    """
    __tablename__ = "user_favorite_foods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "food_id", name="uq_user_favorite_foods_user_food"),
    )


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    fdc_id = Column(Integer, unique=True, nullable=True)
    name = Column(Text, nullable=False)
    calories = Column(Float, nullable=True)
    protein = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    fat = Column(Float, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id"), nullable=False)
    quantity_grams = Column(Float, nullable=False)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    # Filename only (e.g. "3f9a2b1c.jpg"), not a URL - the file lives under
    # UPLOAD_DIR/nutrition/ (see app/storage.py). Retrieval always goes
    # through GET /nutrition/{id}/photo, which checks ownership before
    # reading the file, so nothing here is a publicly-guessable path.
    photo_filename = Column(Text, nullable=True)


class ProgressPhoto(Base):
    """
    A single progress-photo upload, independent of any workout or nutrition
    log - the Progress tab's photo gallery is its own timeline, not tied to
    a specific day's data the way body-weight or nutrition entries are.
    """
    __tablename__ = "progress_photos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_filename = Column(Text, nullable=False)
    taken_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BodyWeightLog(Base):
    __tablename__ = "body_weight_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    weight = Column(Float, nullable=False)
    unit = Column(Text, nullable=False)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())


class CoachConversation(Base):
    """
    One Coach chat thread. A user can hold several, so the Coach tab can
    offer a history list rather than a single ever-growing transcript.
    """
    __tablename__ = "coach_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CoachMessage(Base):
    """
    A single turn in a Coach conversation. `role` is "user" or "assistant";
    the system prompt is rebuilt from live profile/training data on every
    request rather than stored, so a user whose goal or stats have changed
    is never coached against a stale snapshot of themselves.
    """
    __tablename__ = "coach_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("coach_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NutritionTarget(Base):
    __tablename__ = "nutrition_targets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    target_calories = Column(Float, nullable=True)
    target_protein = Column(Float, nullable=True)
    target_carbs = Column(Float, nullable=True)
    target_fat = Column(Float, nullable=True)
    is_manual = Column(Boolean, nullable=False, default=False, server_default=false())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())