from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, auth

router = APIRouter()


@router.get("/progress/body-weight")
def get_body_weight_trend(
    days: Optional[int] = None,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Body weight trend for charting, oldest -> newest. `?days=28` limits
    to the trailing 28 days (matches the 4-weeks/3-months/1-year range
    selector already designed in the UI); omitted, returns everything.

    body_weight_logs stores a unit ("lb" or "kg") per entry, so a user
    who's switched units partway through would otherwise get a trend
    line that silently jumps in magnitude at the switch point. To avoid
    that, every entry here is converted to a single unit before being
    returned - the unit of the user's MOST RECENT log (whatever they're
    currently tracking in). That unit is included in the response so the
    frontend always knows what it's displaying.
    """
    query = db.query(models.BodyWeightLog).filter(
        models.BodyWeightLog.user_id == current_user.id
    )

    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(models.BodyWeightLog.logged_at >= cutoff)

    logs = query.order_by(models.BodyWeightLog.logged_at.asc()).all()

    if not logs:
        return {"unit": None, "entries": []}

    target_unit = logs[-1].unit  # most recent entry's unit

    def to_target_unit(weight: float, unit: str) -> float:
        if unit == target_unit:
            return weight
        if unit == "kg" and target_unit == "lb":
            return weight * 2.20462
        if unit == "lb" and target_unit == "kg":
            return weight / 2.20462
        return weight  # unrecognized unit string - return as-is rather than guess

    return {
        "unit": target_unit,
        "entries": [
            {
                "logged_at": log.logged_at,
                "weight": round(to_target_unit(log.weight, log.unit), 1),
            }
            for log in logs
        ],
    }


@router.get("/progress/e1rm")
def get_e1rm_trend(
    exercise_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    e1RM (estimated 1-rep max) trend for one exercise, oldest -> newest -
    powers the muscle-group -> exercise -> e1RM drilldown chart.

    e1RM is calculated here on every read, never stored, using the
    Epley formula:
        e1RM = weight * (1 + reps / 30)
    It's a standard approximation of the max weight you could lift for a
    single rep, estimated from a set actually performed at a higher rep
    count - used to track strength progress without an actual 1RM test
    every session.
    """
    exercise = db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    sets_with_workout = (
        db.query(models.WorkoutSet, models.UserWorkout)
        .join(models.UserWorkout, models.WorkoutSet.workout_id == models.UserWorkout.id)
        .filter(
            models.UserWorkout.user_id == current_user.id,
            models.WorkoutSet.exercise_id == exercise_id,
            models.WorkoutSet.weight.isnot(None),
            models.WorkoutSet.reps.isnot(None),
        )
        .order_by(models.UserWorkout.started_at.asc())
        .all()
    )

    entries = [
        {
            "date": workout.started_at,
            "weight": workout_set.weight,
            "reps": workout_set.reps,
            "e1rm": round(workout_set.weight * (1 + workout_set.reps / 30), 1),
        }
        for workout_set, workout in sets_with_workout
    ]

    return {
        "exercise_id": exercise.id,
        "exercise_name": exercise.name,
        "muscle_group": exercise.muscle_group,
        "entries": entries,
    }


@router.get("/progress/muscle-groups")
def get_muscle_group_summary(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Muscle-group strength summary: one row per muscle group the user has
    actually trained, with their best (highest) e1RM among all sets
    logged across exercises in that group - a simple "current strength
    level" indicator per body region for the summary view. This is not
    a full trend; see GET /progress/e1rm for that, drilled into a
    specific exercise.

    e1RM (Epley) is computed inline in the aggregate, so this is a
    single grouped query rather than pulling every set into Python.
    """
    e1rm_expr = models.WorkoutSet.weight * (1 + models.WorkoutSet.reps / 30.0)

    results = (
        db.query(
            models.Exercise.muscle_group,
            func.max(e1rm_expr).label("best_e1rm"),
        )
        .select_from(models.WorkoutSet)
        .join(models.UserWorkout, models.WorkoutSet.workout_id == models.UserWorkout.id)
        .join(models.Exercise, models.WorkoutSet.exercise_id == models.Exercise.id)
        .filter(
            models.UserWorkout.user_id == current_user.id,
            models.WorkoutSet.weight.isnot(None),
            models.WorkoutSet.reps.isnot(None),
        )
        .group_by(models.Exercise.muscle_group)
        .order_by(models.Exercise.muscle_group)
        .all()
    )

    return [
        {"muscle_group": muscle_group, "best_e1rm": round(best_e1rm, 1)}
        for muscle_group, best_e1rm in results
    ]


@router.get("/progress/consistency")
def get_consistency(
    days: int = 28,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    "X of Y days trained" over the trailing `days`-day window. A day
    counts as trained if it has at least one FINISHED (ended_at set)
    workout session starting on it - an in-progress session doesn't
    count yet.

    The "day" a session belongs to is the date part of `started_at` as
    stored (server/DB timezone), not the user's local timezone - fine at
    this app's current scale, but worth knowing if a session logged
    right around midnight ever looks off by a day.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    days_trained = (
        db.query(cast(models.UserWorkout.started_at, Date))
        .filter(
            models.UserWorkout.user_id == current_user.id,
            models.UserWorkout.ended_at.isnot(None),
            models.UserWorkout.started_at >= cutoff,
        )
        .distinct()
        .count()
    )

    return {"days_trained": days_trained, "total_days": days}
