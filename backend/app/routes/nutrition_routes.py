from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app import auth, models, schemas, storage
from app.models import Food, NutritionLog, BodyWeightLog, NutritionTarget  # you'll need NutritionLog later too
from app.schemas import FoodIn, FoodOut, NutritionLogIn
from typing import List, Optional
from datetime import datetime

router = APIRouter()


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
    search: str = None
):
    query = db.query(Food).filter(
        or_(
            Food.user_id.is_(None),
            Food.user_id == current_user.id
        )
    )

    if search:
        query = query.filter(Food.name.ilike(f"%{search}%"))

    foods = query.all()
    return foods


@router.post("/nutrition", response_model=schemas.NutritionLogOut)
def add_nutrition_log(
    log: NutritionLogIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    food = db.query(Food).filter(Food.id == log.food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    new_log = NutritionLog(
        user_id=current_user.id,
        food_id=log.food_id,
        quantity_grams=log.quantity_grams,
        logged_at=log.logged_at or datetime.now()
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
        photo_url=new_log.photo_url,
        food=schemas.NutritionLogFoodOut(
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
        ),
    )


@router.post("/nutrition/{log_id}/photo", response_model=schemas.NutritionLogOut)
def upload_nutrition_photo(
    log_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    log = db.query(NutritionLog).filter(
        NutritionLog.id == log_id,
        NutritionLog.user_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Nutrition log not found")

    try:
        log.photo_url = storage.save_upload(file, "nutrition")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    db.refresh(log)

    food = db.query(Food).filter(Food.id == log.food_id).first()
    return schemas.NutritionLogOut(
        id=log.id,
        user_id=log.user_id,
        food_id=log.food_id,
        quantity_grams=log.quantity_grams,
        logged_at=log.logged_at,
        photo_url=log.photo_url,
        food=schemas.NutritionLogFoodOut(
            name=food.name,
            calories=food.calories,
            protein=food.protein,
            carbs=food.carbs,
            fat=food.fat,
        ) if food else None,
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
            photo_url=log.photo_url,
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
        for field, value in target_in.dict(exclude_unset=True).items():
            setattr(target, field, value)
        target.is_manual = True
    else:
        target = NutritionTarget(
            user_id=current_user.id,
            is_manual=True,
            **target_in.dict(),
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

    food = db.query(Food).filter(Food.id == log_update.food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    log.food_id = log_update.food_id
    log.quantity_grams = log_update.quantity_grams
    log.logged_at = log_update.logged_at or datetime.now()

    db.commit()
    db.refresh(log)

    return schemas.NutritionLogOut(
        id=log.id,
        user_id=log.user_id,
        food_id=log.food_id,
        quantity_grams=log.quantity_grams,
        logged_at=log.logged_at,
        photo_url=log.photo_url,
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
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    logs_with_food = (
        db.query(NutritionLog, Food)
        .join(Food, NutritionLog.food_id == Food.id)
        .filter(NutritionLog.user_id == current_user.id)
        .all()
    )

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
        "total_calories": round(total_calories, 1),
        "total_protein": round(total_protein, 1),
        "total_carbs": round(total_carbs, 1),
        "total_fat": round(total_fat, 1)
    }