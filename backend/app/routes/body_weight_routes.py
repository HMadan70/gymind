from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import auth, models, schemas
from app.models import BodyWeightLog
from app.schemas import BodyWeightLogIn
from typing import List
from datetime import datetime

router = APIRouter()


@router.post("/body-weight", response_model=schemas.BodyWeightLogOut)
def add_body_weight_log(
    log: BodyWeightLogIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    new_log = BodyWeightLog(
        user_id=current_user.id,
        weight=log.weight,
        unit=log.unit,
        logged_at=log.logged_at or datetime.now()
    )

    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log


@router.get("/body-weight", response_model=List[schemas.BodyWeightLogOut])
def get_body_weight_logs(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    logs = (
        db.query(BodyWeightLog)
        .filter(BodyWeightLog.user_id == current_user.id)
        .order_by(BodyWeightLog.logged_at.desc())
        .all()
    )
    return logs


@router.put("/body-weight/{log_id}", response_model=schemas.BodyWeightLogOut)
def update_body_weight_log(
    log_id: int,
    log_update: schemas.BodyWeightLogIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    log = db.query(BodyWeightLog).filter(
        BodyWeightLog.id == log_id,
        BodyWeightLog.user_id == current_user.id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Body weight log not found")

    log.weight = log_update.weight
    log.unit = log_update.unit
    log.logged_at = log_update.logged_at or datetime.now()

    db.commit()
    db.refresh(log)
    return log


@router.delete("/body-weight/{log_id}", response_model=dict)
def delete_body_weight_log(
    log_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db)
):
    log = db.query(BodyWeightLog).filter(
        BodyWeightLog.id == log_id,
        BodyWeightLog.user_id == current_user.id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Body weight log not found")

    db.delete(log)
    db.commit()
    return {"detail": "Body weight log deleted successfully"}
