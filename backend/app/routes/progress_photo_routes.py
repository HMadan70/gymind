from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import auth, models, schemas, storage

router = APIRouter()


def _get_owned_progress_photo(db: Session, photo_id: int, user_id: int) -> models.ProgressPhoto:
    photo = db.query(models.ProgressPhoto).filter(
        models.ProgressPhoto.id == photo_id,
        models.ProgressPhoto.user_id == user_id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Progress photo not found")
    return photo


@router.post("/progress-photos", response_model=schemas.ProgressPhotoOut)
def upload_progress_photo(
    photo: UploadFile,
    taken_at: Optional[str] = None,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Basic storage only, per this feature's scope - no image analysis, no
    body-composition estimation from the photo. It's an opaque timestamped
    file the Progress tab's gallery lists and links back to.
    """
    filename = storage.save_photo(photo, "progress")

    new_photo = models.ProgressPhoto(
        user_id=current_user.id,
        photo_filename=filename,
    )
    if taken_at:
        from datetime import datetime

        try:
            new_photo.taken_at = datetime.fromisoformat(taken_at)
        except ValueError:
            storage.delete_photo("progress", filename)
            raise HTTPException(status_code=422, detail="taken_at must be an ISO 8601 datetime")

    db.add(new_photo)
    db.commit()
    db.refresh(new_photo)
    return new_photo


@router.get("/progress-photos", response_model=List[schemas.ProgressPhotoOut])
def list_progress_photos(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ProgressPhoto)
        .filter(models.ProgressPhoto.user_id == current_user.id)
        .order_by(models.ProgressPhoto.taken_at.desc())
        .all()
    )


@router.get("/progress-photos/{photo_id}/photo")
def get_progress_photo_file(
    photo_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    photo = _get_owned_progress_photo(db, photo_id, current_user.id)
    return FileResponse(storage.photo_path("progress", photo.photo_filename))


@router.delete("/progress-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_progress_photo(
    photo_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    photo = _get_owned_progress_photo(db, photo_id, current_user.id)
    filename = photo.photo_filename
    db.delete(photo)
    db.commit()
    storage.delete_photo("progress", filename)
