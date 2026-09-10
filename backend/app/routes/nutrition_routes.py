from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app import auth, models, schemas, storage
from app.models import Food, NutritionLog, BodyWeightLog, NutritionTarget  # you'll need NutritionLog later too
from app.schemas import FoodIn, FoodOut, NutritionLogIn
from typing import List, Literal, Optional, Union
# `date` is aliased because the summary route takes a query param of the
# same name, which would otherwise shadow the type in its own signature.
from datetime import date as date_type, datetime, time, timedelta, timezone

router = APIRouter()

# add_nutrition_log's duplicate-submission guard: see the identical
# constant/comment on workout_routes.py's DUPLICATE_SET_WINDOW_SECONDS for
# the full reasoning. Short window, identity fields only (not logged_at,
# which most callers leave unset and would then almost never coincidentally
# match between an original request and its retry).
DUPLICATE_NUTRITION_LOG_WINDOW_SECONDS = 5


def _get_visible_food(db: Session, food_id: int, user_id: int) -> Food | None:
    """Return shared foods or private foods owned by this user."""
    return db.query(Food).filter(
        Food.id == food_id,
        or_(Food.user_id.is_(None), Food.user_id == user_id),
    ).first()


def calculate_targets(profile: models.UserProfile, latest_weight: Optional[BodyWeightLog]) -> dict:
    """
    Derives daily calorie/macro targets from whatever profile data we
    actually have.

    FORMULA CHOICE: user_profiles has no age/height/sex columns, so a real
    Mifflin-St Jeor BMR calculation isn't possible here - those fields
    just don't exist in the schema yet. Instead this uses the bodyweight
    heuristic common in fitness coaching, which only needs weight + goal:
      - calories = bodyweight_lb * a goal-dependent multiplier
        (cut: 12, maintain: 15, bulk: 17 kcal/lb - standard rough TDEE
        estimates for a moderately active adult at each goal)
      - protein  = 1 g/lb bodyweight (standard resistance-training target)
      - fat      = 0.35 g/lb bodyweight (keeps fat around ~25-30% of
        calories at these intakes, protects hormone health)
      - carbs    = whatever calories are left after protein/fat, at 4 kcal/g

    UserProfile.goal is free text (not an enum), so it's keyword-matched
    into cut/bulk/maintain buckets rather than switched on exactly.

    ASSUMPTION: if the user has no body_weight_logs entry yet, we fall
    back to a neutral 150 lb so a target can still be produced. This is a
    placeholder - it self-corrects once they log a real weight and
    targets get recalculated.
    """
    if latest_weight is not None:
        weight_lb = (
            latest_weight.weight * 2.20462
            if latest_weight.unit == "kg"
            else latest_weight.weight
        )
    else:
        weight_lb = 150.0

    goal = (profile.goal or "").lower() if profile else ""
    if any(k in goal for k in ("lose", "cut", "fat loss", "deficit", "lean")):
        cal_per_lb = 12
    elif any(k in goal for k in ("gain", "bulk", "muscle", "mass", "surplus")):
        cal_per_lb = 17
    else:
        cal_per_lb = 15  # maintenance / unspecified goal

    target_calories = round(weight_lb * cal_per_lb, 1)
    target_protein = round(weight_lb * 1.0, 1)
    target_fat = round(weight_lb * 0.35, 1)
    remaining_calories = target_calories - (target_protein * 4) - (target_fat * 9)
    target_carbs = round(max(remaining_calories, 0) / 4, 1)

    return {
        "target_calories": target_calories,
        "target_protein": target_protein,
        "target_carbs": target_carbs,
        "target_fat": target_fat,
    }


def _calculate_targets_for_user(current_user: models.User, db: Session) -> dict:
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.user_id == current_user.id
    ).first()

    latest_weight = (
        db.query(BodyWeightLog)
        .filter(BodyWeightLog.user_id == current_user.id)
        .order_by(BodyWeightLog.logged_at.desc())
        .first()
    )

    return calculate_targets(profile, latest_weight)

@router.post("/foods", response_model=FoodOut)
def add_food(
    food: FoodIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    new_food = Food(
    name=food.name,
    calories=food.calories,
    protein=food.protein,
    carbs=food.carbs,
    fat=food.fat,
    user_id=current_user.id
)
    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    return new_food



@router.get("/foods", response_model=List[FoodOut])
def get_food(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
    search: str = None,
    favorites_only: bool = False
):
    # is_favorited comes from an outer join against this user's rows in
    # user_favorite_foods, so a shared USDA food can be favourited by one
    # user without affecting anyone else. Mirrors GET /exercises.
    query = (
        db.query(
            Food,
            models.UserFavoriteFood.id.isnot(None).label("is_favorited"),
        )
        .outerjoin(
            models.UserFavoriteFood,
            (models.UserFavoriteFood.food_id == Food.id)
            & (models.UserFavoriteFood.user_id == current_user.id),
        )
        .filter(
            or_(
                Food.user_id.is_(None),
                Food.user_id == current_user.id
            )
        )
    )

    if favorites_only:
        query = query.filter(models.UserFavoriteFood.id.isnot(None))

    if search:
        query = query.filter(Food.name.ilike(f"%{search}%"))

    results = query.all()
    return [
        FoodOut(
            id=food.id,
            fdc_id=food.fdc_id,
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
            user_id=food.user_id,
            is_favorited=bool(is_favorited),
        )
        for food, is_favorited in results
    ]


@router.post("/foods/{food_id}/favorite", response_model=schemas.FavoriteFoodOut)
def favorite_food(
    food_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    food = _get_visible_food(db, food_id, current_user.id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    existing = db.query(models.UserFavoriteFood).filter(
        models.UserFavoriteFood.user_id == current_user.id,
        models.UserFavoriteFood.food_id == food_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Food already favorited")

    favorite = models.UserFavoriteFood(user_id=current_user.id, food_id=food_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/foods/{food_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def unfavorite_food(
    food_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    favorite = db.query(models.UserFavoriteFood).filter(
        models.UserFavoriteFood.user_id == current_user.id,
        models.UserFavoriteFood.food_id == food_id,
    ).first()

    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    db.delete(favorite)
    db.commit()


@router.post("/nutrition", response_model=schemas.NutritionLogOut)
def add_nutrition_log(
    log: NutritionLogIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    food = _get_visible_food(db, log.food_id, current_user.id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    # Duplicate-submission guard - see the constant's comment above. Handles
    # a bypassed frontend guard or an ordinary network retry the same way
    # workout_routes.py's add_set does: return the recent identical row
    # instead of inserting a second one.
    duplicate_cutoff = datetime.now(timezone.utc) - timedelta(seconds=DUPLICATE_NUTRITION_LOG_WINDOW_SECONDS)
    existing_log = db.query(NutritionLog).filter(
        NutritionLog.user_id == current_user.id,
        NutritionLog.food_id == log.food_id,
        NutritionLog.quantity_grams == log.quantity_grams,
        NutritionLog.created_at >= duplicate_cutoff,
    ).first()

    if existing_log is not None:
        new_log = existing_log
    else:
        new_log = NutritionLog(
            user_id=current_user.id,
            food_id=log.food_id,
            quantity_grams=log.quantity_grams,
            # tz-aware: logged_at is timestamptz, so a naive local datetime
            # would be stored skewed on any host whose clock isn't UTC.
            logged_at=log.logged_at or datetime.now(timezone.utc)
        )

        db.add(new_log)
        db.commit()
        db.refresh(new_log)

    return schemas.NutritionLogOut(
        id=new_log.id,
        user_id=new_log.user_id,
        food_id=new_log.food_id,
        quantity_grams=new_log.quantity_grams,
        logged_at=new_log.logged_at,
        photo_filename=new_log.photo_filename,
        food=schemas.NutritionLogFoodOut(
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
        ),
    )

@router.get("/nutrition", response_model=List[schemas.NutritionLogOut])
def get_nutrition_logs(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
    search: str = None
):
    query = (
        db.query(NutritionLog, Food)
        .join(Food, NutritionLog.food_id == Food.id)
        .filter(NutritionLog.user_id == current_user.id)
    )

    if search:
        query = query.filter(Food.name.ilike(f"%{search}%"))

    logs_with_food = query.all()

    return [
        schemas.NutritionLogOut(
            id=log.id,
            user_id=log.user_id,
            food_id=log.food_id,
            quantity_grams=log.quantity_grams,
            logged_at=log.logged_at,
            photo_filename=log.photo_filename,
            food=schemas.NutritionLogFoodOut(
                name=food.name,
                calories=food.calories,
                protein=food.protein,
                carbs=food.carbs,
                fat=food.fat,
            ),
        )
        for log, food in logs_with_food
    ]


@router.get("/nutrition/targets", response_model=schemas.NutritionTargetOut)
def get_nutrition_targets(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    target = db.query(NutritionTarget).filter(
        NutritionTarget.user_id == current_user.id
    ).first()

    if not target:
        calculated = _calculate_targets_for_user(current_user, db)
        target = NutritionTarget(
            user_id=current_user.id,
            is_manual=False,
            **calculated,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

    return target


@router.put("/nutrition/targets", response_model=schemas.NutritionTargetOut)
def update_nutrition_targets(
    target_in: schemas.NutritionTargetIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    target = db.query(NutritionTarget).filter(
        NutritionTarget.user_id == current_user.id
    ).first()

    if target:
        for field, value in target_in.model_dump(exclude_unset=True).items():
            setattr(target, field, value)
        target.is_manual = True
    else:
        target = NutritionTarget(
            user_id=current_user.id,
            is_manual=True,
            **target_in.model_dump(),
        )
        db.add(target)

    db.commit()
    db.refresh(target)
    return target


@router.post("/nutrition/targets/reset", response_model=schemas.NutritionTargetOut)
def reset_nutrition_targets(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    calculated = _calculate_targets_for_user(current_user, db)

    target = db.query(NutritionTarget).filter(
        NutritionTarget.user_id == current_user.id
    ).first()

    if target:
        for field, value in calculated.items():
            setattr(target, field, value)
        target.is_manual = False
    else:
        target = NutritionTarget(
            user_id=current_user.id,
            is_manual=False,
            **calculated,
        )
        db.add(target)

    db.commit()
    db.refresh(target)
    return target


@router.put("/nutrition/{log_id}", response_model=schemas.NutritionLogOut)
def update_nutrition_log(
    log_id: int,
    log_update: schemas.NutritionLogIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    log = db.query(NutritionLog).filter(
        NutritionLog.id == log_id,
        NutritionLog.user_id == current_user.id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Nutrition log not found")

    food = _get_visible_food(db, log_update.food_id, current_user.id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    log.food_id = log_update.food_id
    log.quantity_grams = log_update.quantity_grams
    # tz-aware, same as the POST above.
    log.logged_at = log_update.logged_at or datetime.now(timezone.utc)

    db.commit()
    db.refresh(log)

    return schemas.NutritionLogOut(
        id=log.id,
        user_id=log.user_id,
        food_id=log.food_id,
        quantity_grams=log.quantity_grams,
        logged_at=log.logged_at,
        photo_filename=log.photo_filename,
        food=schemas.NutritionLogFoodOut(
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
        ),
    )


@router.delete("/nutrition/{log_id}", response_model=dict)
def delete_nutrition_log(
    log_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    log = db.query(NutritionLog).filter(
        NutritionLog.id == log_id,
        NutritionLog.user_id == current_user.id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Nutrition log not found")

    db.delete(log)
    db.commit()
    return {"detail": "Nutrition log deleted successfully"}


@router.get("/nutrition/summary")
def get_nutrition_summary(
    date: Optional[Union[date_type, Literal["all"]]] = None,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    """
    Calorie/macro totals. `?date=YYYY-MM-DD` picks a day, omitting it
    means today, and `?date=all` is the escape hatch back to the
    every-log-ever total this route used to return unconditionally.

    A single day is bounded as a half-open UTC range rather than a DATE()
    cast on the column, so the timestamptz index stays usable. "Today" is
    therefore the server's UTC day, not the caller's local day - the same
    convention (and the same caveat) as /progress/consistency.
    """
    all_time = date == "all"
    target_date = None if all_time else (date or datetime.now(timezone.utc).date())

    query = (
        db.query(NutritionLog, Food)
        .join(Food, NutritionLog.food_id == Food.id)
        .filter(NutritionLog.user_id == current_user.id)
    )

    if not all_time:
        day_start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
        query = query.filter(
            NutritionLog.logged_at >= day_start,
            NutritionLog.logged_at < day_start + timedelta(days=1),
        )

    logs_with_food = query.all()

    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0

    for log, food in logs_with_food:
        factor = log.quantity_grams / 100
        total_calories += food.calories * factor
        total_protein += food.protein * factor
        total_carbs += food.carbs * factor
        total_fat += food.fat * factor

    return {
        # Echoed back so a caller relying on the default knows which day
        # it actually got ("all" when the day filter was skipped).
        "date": "all" if all_time else target_date.isoformat(),
        "total_calories": round(total_calories, 1),
        "total_protein": round(total_protein, 1),
        "total_carbs": round(total_carbs, 1),
        "total_fat": round(total_fat, 1)
    }


def _get_owned_nutrition_log(db: Session, log_id: int, user_id: int) -> NutritionLog:
    log = db.query(NutritionLog).filter(
        NutritionLog.id == log_id,
        NutritionLog.user_id == user_id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Nutrition log not found")
    return log


@router.post("/nutrition/{log_id}/photo", response_model=schemas.NutritionLogOut)
def upload_nutrition_log_photo(
    log_id: int,
    photo: UploadFile,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Attaches a photo to an already-logged meal. Basic storage only - no
    image analysis, no macro estimation from the photo; the macros on this
    log are still whatever the caller entered manually via POST /nutrition.
    """
    log = _get_owned_nutrition_log(db, log_id, current_user.id)
    food = _get_visible_food(db, log.food_id, current_user.id)

    old_filename = log.photo_filename
    log.photo_filename = storage.save_photo(photo, "nutrition")
    db.commit()
    db.refresh(log)

    # Replacing a photo, not adding a second one - drop the old file now
    # that the new one is committed, so uploads never leak on re-attach.
    if old_filename:
        storage.delete_photo("nutrition", old_filename)

    return schemas.NutritionLogOut(
        id=log.id,
        user_id=log.user_id,
        food_id=log.food_id,
        quantity_grams=log.quantity_grams,
        logged_at=log.logged_at,
        photo_filename=log.photo_filename,
        food=schemas.NutritionLogFoodOut(
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
        ) if food else None,
    )


@router.get("/nutrition/{log_id}/photo")
def get_nutrition_log_photo(
    log_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    log = _get_owned_nutrition_log(db, log_id, current_user.id)
    if not log.photo_filename:
        raise HTTPException(status_code=404, detail="This log has no photo")
    return FileResponse(storage.photo_path("nutrition", log.photo_filename))


@router.delete("/nutrition/{log_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
def delete_nutrition_log_photo(
    log_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    log = _get_owned_nutrition_log(db, log_id, current_user.id)
    if not log.photo_filename:
        raise HTTPException(status_code=404, detail="This log has no photo")

    filename = log.photo_filename
    log.photo_filename = None
    db.commit()
    storage.delete_photo("nutrition", filename)
