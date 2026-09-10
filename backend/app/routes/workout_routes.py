from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter()

# How long after a workout is finished its sets stay editable. Shared by
# the edit route's 409 guard and exposed to the client so the UI can hide
# the edit affordance on the same boundary the server enforces.
EDIT_WINDOW_DAYS = 7


def _get_visible_exercise(
    db: Session,
    exercise_id: int,
    user_id: int,
) -> models.Exercise | None:
    """Return shared exercises or private exercises owned by this user."""
    return db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id,
        or_(
            models.Exercise.user_id.is_(None),
            models.Exercise.user_id == user_id,
        ),
    ).first()


@router.post("/exercises", response_model=schemas.ExerciseOut)
def add_exercise(
    exercise: schemas.ExerciseIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    new_exercise = models.Exercise(
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        user_id=current_user.id,
    )
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return schemas.ExerciseOut(
        id=new_exercise.id,
        name=new_exercise.name,
        muscle_group=new_exercise.muscle_group,
        user_id=new_exercise.user_id,
        is_favorited=False,
    )


@router.get("/exercises", response_model=list[schemas.ExerciseOut])
def get_exercises(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
    search: str = None,
    favorites_only: bool = False,
    muscle_group: str = None,
):
    query = (
        db.query(
            models.Exercise,
            models.UserFavoriteExercise.id.isnot(None).label("is_favorited"),
        )
        .outerjoin(
            models.UserFavoriteExercise,
            (models.UserFavoriteExercise.exercise_id == models.Exercise.id)
            & (models.UserFavoriteExercise.user_id == current_user.id),
        )
        .filter(
            or_(
                models.Exercise.user_id.is_(None),
                models.Exercise.user_id == current_user.id,
            )
        )
    )

    if favorites_only:
        query = query.filter(models.UserFavoriteExercise.id.isnot(None))

    if muscle_group:
        query = query.filter(models.Exercise.muscle_group == muscle_group)

    if search:
        query = query.filter(models.Exercise.name.ilike(f"{search}%"))

    results = query.all()
    return [
        schemas.ExerciseOut(
            id=exercise.id,
            name=exercise.name,
            muscle_group=exercise.muscle_group,
            user_id=exercise.user_id,
            is_favorited=bool(is_favorited),
        )
        for exercise, is_favorited in results
    ]


@router.post("/exercises/{exercise_id}/favorite", response_model=schemas.FavoriteExerciseOut)
def favorite_exercise(
    exercise_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    exercise = _get_visible_exercise(db, exercise_id, current_user.id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    existing = db.query(models.UserFavoriteExercise).filter(
        models.UserFavoriteExercise.user_id == current_user.id,
        models.UserFavoriteExercise.exercise_id == exercise_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Exercise already favorited")

    favorite = models.UserFavoriteExercise(user_id=current_user.id, exercise_id=exercise_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/exercises/{exercise_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def unfavorite_exercise(
    exercise_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    favorite = db.query(models.UserFavoriteExercise).filter(
        models.UserFavoriteExercise.user_id == current_user.id,
        models.UserFavoriteExercise.exercise_id == exercise_id,
    ).first()

    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    db.delete(favorite)
    db.commit()


@router.get("/exercises/{exercise_id}/history", response_model=schemas.ExerciseHistoryOut)
def get_exercise_history(
    exercise_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    if not _get_visible_exercise(db, exercise_id, current_user.id):
        raise HTTPException(status_code=404, detail="Exercise not found")

    most_recent_workout = (
        db.query(models.UserWorkout)
        .join(models.WorkoutSet, models.WorkoutSet.workout_id == models.UserWorkout.id)
        .filter(
            models.UserWorkout.user_id == current_user.id,
            models.UserWorkout.ended_at.isnot(None),
            func.date(models.UserWorkout.ended_at) < func.current_date(),
            models.WorkoutSet.exercise_id == exercise_id,
        )
        .order_by(models.UserWorkout.ended_at.desc())
        .first()
    )

    if not most_recent_workout:
        return schemas.ExerciseHistoryOut(previous_sets=[], suggested_target_weight=None)

    previous_workout_sets = (
        db.query(models.WorkoutSet)
        .filter(
            models.WorkoutSet.workout_id == most_recent_workout.id,
            models.WorkoutSet.exercise_id == exercise_id,
        )
        .order_by(models.WorkoutSet.set_number)
        .all()
    )

    weights = [s.weight for s in previous_workout_sets if s.weight is not None]

    return schemas.ExerciseHistoryOut(
        previous_sets=[
            schemas.ExerciseHistorySetOut(set_number=s.set_number, weight=s.weight, reps=s.reps)
            for s in previous_workout_sets
        ],
        suggested_target_weight=(max(weights) + 5) if weights else None,
    )


@router.post("/workouts", response_model=schemas.UserWorkoutOut)
def create_workout(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    new_workout = models.UserWorkout(user_id=current_user.id)
    db.add(new_workout)
    db.commit()
    db.refresh(new_workout)
    return new_workout

@router.get("/workouts", response_model=list[schemas.UserWorkoutOut])
def list_workouts(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    workouts = db.query(models.UserWorkout).filter(
        models.UserWorkout.user_id == current_user.id
    ).all()
    return workouts

@router.put("/workouts/{workout_id}", response_model=schemas.UserWorkoutOut)
def finish_workout(
    workout_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    workout = db.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id,
        models.UserWorkout.user_id == current_user.id,
    ).first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    workout.ended_at = func.now()
    db.commit()
    db.refresh(workout)
    return workout

@router.post("/workouts/{workout_id}/sets", response_model=schemas.WorkoutSetOut)
def add_set(
    workout_id: int,
    set_in: schemas.WorkoutSetIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    workout = db.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id,
        models.UserWorkout.user_id == current_user.id,
    ).first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if workout.ended_at is not None:
        raise HTTPException(
            status_code=409,
            detail="Cannot add a set to a finished workout session",
        )

    exercise = _get_visible_exercise(db, set_in.exercise_id, current_user.id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    new_set = models.WorkoutSet(workout_id=workout_id, **set_in.model_dump())
    db.add(new_set)
    db.commit()
    db.refresh(new_set)

    return schemas.WorkoutSetOut(
        id=new_set.id,
        workout_id=new_set.workout_id,
        exercise_id=new_set.exercise_id,
        set_number=new_set.set_number,
        weight=new_set.weight,
        reps=new_set.reps,
        exercise=schemas.WorkoutSetExerciseOut(
            name=exercise.name,
            muscle_group=exercise.muscle_group,
        ),
    )


@router.put(
    "/workouts/{workout_id}/sets/{set_id}",
    response_model=schemas.WorkoutSetOut,
)
def update_set(
    workout_id: int,
    set_id: int,
    set_in: schemas.WorkoutSetUpdate,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Correct the weight/reps of an already-logged set.

    Editing is only allowed for the first EDIT_WINDOW_DAYS days after a
    session was finished. This window is enforced here, server-side, and
    not only in the UI: the client hides the edit affordance on older
    workouts, but a hidden button is not an access control, so the same
    rule has to hold for anyone calling the API directly.

    An unfinished session (ended_at is NULL) is still in progress, so it
    is always editable — the window only starts once a workout is done.
    """
    workout = db.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id,
        models.UserWorkout.user_id == current_user.id,
    ).first()

    # 404 rather than 403 for someone else's workout, so this route
    # can't be used to probe which workout ids exist.
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if workout.ended_at is not None:
        ended_at = workout.ended_at
        # Rows written before the column was timezone-aware can come
        # back naive; treat those as UTC rather than crashing on the
        # aware/naive comparison below.
        if ended_at.tzinfo is None:
            ended_at = ended_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) - ended_at > timedelta(days=EDIT_WINDOW_DAYS):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"This workout finished more than {EDIT_WINDOW_DAYS} days ago "
                    "and can no longer be edited"
                ),
            )

    workout_set = db.query(models.WorkoutSet).filter(
        models.WorkoutSet.id == set_id,
        models.WorkoutSet.workout_id == workout_id,
    ).first()

    if not workout_set:
        raise HTTPException(status_code=404, detail="Set not found")

    workout_set.weight = set_in.weight
    workout_set.reps = set_in.reps
    db.commit()
    db.refresh(workout_set)

    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == workout_set.exercise_id
    ).first()

    return schemas.WorkoutSetOut(
        id=workout_set.id,
        workout_id=workout_set.workout_id,
        exercise_id=workout_set.exercise_id,
        set_number=workout_set.set_number,
        weight=workout_set.weight,
        reps=workout_set.reps,
        exercise=schemas.WorkoutSetExerciseOut(
            name=exercise.name,
            muscle_group=exercise.muscle_group,
        ) if exercise else None,
    )


@router.get("/workouts/{workout_id}", response_model=schemas.UserWorkoutDetail)
def get_workout(
    workout_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    workout = db.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id,
        models.UserWorkout.user_id == current_user.id,
    ).first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    sets_with_exercise = (
        db.query(models.WorkoutSet, models.Exercise)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(models.WorkoutSet.workout_id == workout_id)
        .all()
    )

    notes_by_exercise_id = {
        note.exercise_id: note.note
        for note in db.query(models.WorkoutExerciseNote).filter(
            models.WorkoutExerciseNote.workout_id == workout_id
        )
    }

    sets = [
        schemas.WorkoutSetOut(
            id=workout_set.id,
            workout_id=workout_set.workout_id,
            exercise_id=workout_set.exercise_id,
            set_number=workout_set.set_number,
            weight=workout_set.weight,
            reps=workout_set.reps,
            exercise=schemas.WorkoutSetExerciseOut(
                name=exercise.name,
                muscle_group=exercise.muscle_group,
                note=notes_by_exercise_id.get(exercise.id),
            ),
        )
        for workout_set, exercise in sets_with_exercise
    ]

    return schemas.UserWorkoutDetail(
        id=workout.id,
        user_id=workout.user_id,
        started_at=workout.started_at,
        ended_at=workout.ended_at,
        sets=sets,
    )


@router.put(
    "/workouts/{workout_id}/exercises/{exercise_id}/note",
    response_model=schemas.WorkoutExerciseNoteOut,
)
def upsert_exercise_note(
    workout_id: int,
    exercise_id: int,
    note_in: schemas.WorkoutExerciseNoteIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    workout = db.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id,
        models.UserWorkout.user_id == current_user.id,
    ).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    exercise = _get_visible_exercise(db, exercise_id, current_user.id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    note = db.query(models.WorkoutExerciseNote).filter(
        models.WorkoutExerciseNote.workout_id == workout_id,
        models.WorkoutExerciseNote.exercise_id == exercise_id,
    ).first()

    if note:
        note.note = note_in.note
    else:
        note = models.WorkoutExerciseNote(
            workout_id=workout_id,
            exercise_id=exercise_id,
            note=note_in.note,
        )
        db.add(note)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),

):
    workout = (
        db.query(models.UserWorkout)
        .filter(models.UserWorkout.id == workout_id, models.UserWorkout.user_id == current_user.id)
        .first()
    )

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    db.delete(workout)
    db.commit()
