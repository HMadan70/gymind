from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter()


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
    exercise = db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()
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

    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == set_in.exercise_id
    ).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    new_set = models.WorkoutSet(workout_id=workout_id, **set_in.dict())
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
