"""
Tests for basic photo upload/retrieval - nutrition-log photos and progress
photos. No image analysis or macro estimation is exercised here because
none exists; storage.save_photo never looks at pixel content.
"""
import io

import pytest

from app import storage
from app.rate_limit import limiter

# A minimal valid 1x1 PNG, so tests exercise the real content-type/size
# validation path in storage.save_photo rather than skipping it.
_ONE_PIXEL_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
    "53de0000000c4944415478da6360000002000155a2d1f30000000049454e44"
    "ae426082"
)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def isolate_upload_dir(tmp_path, monkeypatch):
    """Redirects storage to a throwaway directory so tests never touch the
    real UPLOAD_DIR (dev or production)."""
    monkeypatch.setattr(storage, "UPLOAD_DIR", tmp_path)
    yield


def register_login_and_create_profile(client, email, username, password="TestPass123!"):
    client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    login_response = client.post(
        "/auth/login",
        json={"identifier": username, "password": password},
    )
    token = login_response.json()["access_token"]
    client.post(
        "/users/profile",
        json={"goal": "test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


def png_file(name="photo.png"):
    return {"photo": (name, io.BytesIO(_ONE_PIXEL_PNG), "image/png")}


# ---------------------------------------------------------------------------
# Nutrition log photos
# ---------------------------------------------------------------------------


def _create_food_and_log(client, headers):
    food_id = client.post(
        "/foods",
        json={"name": "Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6},
        headers=headers,
    ).json()["id"]
    log_id = client.post(
        "/nutrition",
        json={"food_id": food_id, "quantity_grams": 150},
        headers=headers,
    ).json()["id"]
    return log_id


def test_nutrition_photo_requires_profile(client):
    client.post(
        "/auth/register",
        json={"email": "nophoto@example.com", "username": "nophotouser", "password": "TestPass123!"},
    )
    token = client.post(
        "/auth/login",
        json={"identifier": "nophotouser", "password": "TestPass123!"},
    ).json()["access_token"]

    response = client.post(
        "/nutrition/1/photo",
        files=png_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_nutrition_log_starts_with_no_photo(client):
    token = register_login_and_create_profile(client, "logstart@example.com", "logstartuser")
    headers = {"Authorization": f"Bearer {token}"}
    log_id = _create_food_and_log(client, headers)

    log = next(l for l in client.get("/nutrition", headers=headers).json() if l["id"] == log_id)
    assert log["has_photo"] is False


def test_nutrition_photo_upload_and_retrieve(client):
    token = register_login_and_create_profile(client, "photoupload@example.com", "photouploaduser")
    headers = {"Authorization": f"Bearer {token}"}
    log_id = _create_food_and_log(client, headers)

    upload = client.post(f"/nutrition/{log_id}/photo", files=png_file(), headers=headers)
    assert upload.status_code == 200
    assert upload.json()["has_photo"] is True

    retrieve = client.get(f"/nutrition/{log_id}/photo", headers=headers)
    assert retrieve.status_code == 200
    assert retrieve.content == _ONE_PIXEL_PNG
    assert retrieve.headers["content-type"] == "image/png"


def test_nutrition_photo_rejects_non_image_content_type(client):
    token = register_login_and_create_profile(client, "badtype@example.com", "badtypeuser")
    headers = {"Authorization": f"Bearer {token}"}
    log_id = _create_food_and_log(client, headers)

    response = client.post(
        f"/nutrition/{log_id}/photo",
        files={"photo": ("evil.txt", io.BytesIO(b"not a photo"), "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_nutrition_photo_re_upload_replaces_and_deletes_old_file(client):
    token = register_login_and_create_profile(client, "replace@example.com", "replaceuser")
    headers = {"Authorization": f"Bearer {token}"}
    log_id = _create_food_and_log(client, headers)

    first = client.post(f"/nutrition/{log_id}/photo", files=png_file("first.png"), headers=headers)
    first_filename = storage.UPLOAD_DIR / "nutrition"
    first_files = set((first_filename).iterdir())

    second = client.post(f"/nutrition/{log_id}/photo", files=png_file("second.png"), headers=headers)
    assert second.status_code == 200

    second_files = set((first_filename).iterdir())
    # The old file's gone, exactly one file remains, and it's not the one
    # from the first upload.
    assert len(second_files) == 1
    assert second_files != first_files


def test_nutrition_photo_delete(client):
    token = register_login_and_create_profile(client, "photodelete@example.com", "photodeleteuser")
    headers = {"Authorization": f"Bearer {token}"}
    log_id = _create_food_and_log(client, headers)
    client.post(f"/nutrition/{log_id}/photo", files=png_file(), headers=headers)

    response = client.delete(f"/nutrition/{log_id}/photo", headers=headers)
    assert response.status_code == 204
    assert client.get(f"/nutrition/{log_id}/photo", headers=headers).status_code == 404
    assert list((storage.UPLOAD_DIR / "nutrition").iterdir()) == []


def test_nutrition_photo_cannot_be_accessed_by_another_user(client):
    owner_token = register_login_and_create_profile(client, "photoowner@example.com", "photoowneruser")
    log_id = _create_food_and_log(client, {"Authorization": f"Bearer {owner_token}"})
    client.post(
        f"/nutrition/{log_id}/photo",
        files=png_file(),
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    intruder_token = register_login_and_create_profile(client, "photointruder@example.com", "photointruderuser")
    response = client.get(
        f"/nutrition/{log_id}/photo",
        headers={"Authorization": f"Bearer {intruder_token}"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Progress photos
# ---------------------------------------------------------------------------


def test_progress_photo_requires_profile(client):
    client.post(
        "/auth/register",
        json={"email": "noprogress@example.com", "username": "noprogressuser", "password": "TestPass123!"},
    )
    token = client.post(
        "/auth/login",
        json={"identifier": "noprogressuser", "password": "TestPass123!"},
    ).json()["access_token"]

    response = client.post(
        "/progress-photos",
        files=png_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_progress_photo_upload_list_and_retrieve(client):
    token = register_login_and_create_profile(client, "progressphoto@example.com", "progressphotouser")
    headers = {"Authorization": f"Bearer {token}"}

    upload = client.post("/progress-photos", files=png_file(), headers=headers)
    assert upload.status_code == 200
    photo_id = upload.json()["id"]
    assert "taken_at" in upload.json()

    listing = client.get("/progress-photos", headers=headers)
    assert listing.status_code == 200
    assert [p["id"] for p in listing.json()] == [photo_id]

    retrieve = client.get(f"/progress-photos/{photo_id}/photo", headers=headers)
    assert retrieve.status_code == 200
    assert retrieve.content == _ONE_PIXEL_PNG


def test_progress_photo_delete_removes_row_and_file(client):
    token = register_login_and_create_profile(client, "progressdelete@example.com", "progressdeleteuser")
    headers = {"Authorization": f"Bearer {token}"}
    photo_id = client.post("/progress-photos", files=png_file(), headers=headers).json()["id"]

    response = client.delete(f"/progress-photos/{photo_id}", headers=headers)
    assert response.status_code == 204
    assert client.get("/progress-photos", headers=headers).json() == []
    assert list((storage.UPLOAD_DIR / "progress").iterdir()) == []


def test_progress_photo_isolated_per_user(client):
    owner_token = register_login_and_create_profile(client, "progressowner@example.com", "progressowneruser")
    photo_id = client.post(
        "/progress-photos", files=png_file(), headers={"Authorization": f"Bearer {owner_token}"}
    ).json()["id"]

    intruder_token = register_login_and_create_profile(client, "progressintruder@example.com", "progressintruderuser")
    intruder_headers = {"Authorization": f"Bearer {intruder_token}"}

    assert client.get("/progress-photos", headers=intruder_headers).json() == []
    assert client.get(f"/progress-photos/{photo_id}/photo", headers=intruder_headers).status_code == 404
    assert client.delete(f"/progress-photos/{photo_id}", headers=intruder_headers).status_code == 404


def test_progress_photo_rejects_oversized_upload(client, monkeypatch):
    monkeypatch.setattr(storage, "MAX_UPLOAD_BYTES", 10)
    token = register_login_and_create_profile(client, "toobig@example.com", "toobiguser")
    response = client.post(
        "/progress-photos",
        files=png_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413
    assert list((storage.UPLOAD_DIR / "progress").iterdir()) == []
