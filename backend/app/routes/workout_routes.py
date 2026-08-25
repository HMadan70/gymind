from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter()


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

    new_set = models.WorkoutSet(workout_id=workout_id, **set_in.dict())
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set


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

    sets = db.query(models.WorkoutSet).filter(
        models.WorkoutSet.workout_id == workout_id
    ).all()

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
