"""
Local-volume file storage for user-uploaded photos (meal photos,
progress photos).

DECISION (2026-09-05, PROJECT_STATUS.md Phase 3.5): local storage over an
object-storage service (S3-compatible, etc). This is a solo/portfolio
project self-hosted on one ZimaOS box (PROJECT_STATUS.md Section 6) -
there's no multi-region/CDN requirement, no second environment that would
need to share the files, and standing up object storage (a new service,
credentials, a bucket lifecycle policy) is real complexity with no payoff
at this scale. A named Docker volume (`gymind_uploads`, see
docker-compose.yml) survives container rebuilds exactly like the existing
`gymind_pgdata` volume does for Postgres - same pattern already trusted
for the database, reused here. If this ever needs to scale past one
server, swapping this module's two functions for an S3 client is a
contained change - nothing else in the app talks to the filesystem
directly.
"""
import os
import uuid
from fastapi import UploadFile

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXTENSION_BY_CONTENT_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def save_upload(file: UploadFile, subdir: str) -> str:
    """
    Saves an uploaded image to UPLOAD_DIR/subdir/<uuid>.<ext> and returns
    the URL path it's served at (mounted at /uploads in main.py).
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Unsupported content type: {file.content_type}")

    extension = EXTENSION_BY_CONTENT_TYPE[file.content_type]
    filename = f"{uuid.uuid4().hex}{extension}"

    target_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(target_dir, exist_ok=True)

    target_path = os.path.join(target_dir, filename)
    with open(target_path, "wb") as out:
        out.write(file.file.read())

    return f"/uploads/{subdir}/{filename}"


def delete_upload(url: str) -> None:
    """Best-effort delete of a file previously saved by save_upload().
    Never raises - an already-missing file shouldn't block the DB delete."""
    if not url or not url.startswith("/uploads/"):
        return
    path = os.path.join(UPLOAD_DIR, url.removeprefix("/uploads/"))
    try:
        os.remove(path)
    except OSError:
        pass
