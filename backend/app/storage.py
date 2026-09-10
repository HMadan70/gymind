"""
Local-filesystem storage for uploaded photos (meal photos, progress photos).

Local disk rather than object storage: this app is self-hosted on a home
server with no cloud storage account configured anywhere in the stack, and
nothing else here talks to S3/GCS-style APIs. UPLOAD_DIR is a plain
directory, mirroring how backend/scripts/seed_reference_data.py resolves
its own data directory relative to the package.

Deliberately out of scope, per the task this module was built for: no image
analysis, no macro estimation from a photo. A photo is an opaque uploaded
file - nothing here ever looks at its pixels.
"""
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR") or Path(__file__).resolve().parent.parent / "uploads")

# Content-type allowlist, not a byte-sniffed check - a client can lie about
# this header. That's an acceptable gap for a basic-upload feature with no
# further processing of the file (it's never executed, parsed, or served
# with a browser-inferred content-type), consistent with this task's scope.
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXTENSION_BY_CONTENT_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def save_photo(upload: UploadFile, subdir: str) -> str:
    """
    Validates and saves an uploaded photo under UPLOAD_DIR/<subdir>/,
    returning the generated filename (not a path) to store in the database.
    """
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Photo must be JPEG, PNG, or WEBP.",
        )

    directory = UPLOAD_DIR / subdir
    directory.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{EXTENSION_BY_CONTENT_TYPE[upload.content_type]}"
    destination = directory / filename

    size = 0
    with destination.open("wb") as out_file:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out_file.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Photo must be 8MB or smaller.")
            out_file.write(chunk)

    return filename


def photo_path(subdir: str, filename: str) -> Path:
    return UPLOAD_DIR / subdir / filename


def delete_photo(subdir: str, filename: str) -> None:
    photo_path(subdir, filename).unlink(missing_ok=True)
