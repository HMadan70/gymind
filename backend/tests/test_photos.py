import os

import pytest

from app.rate_limit import limiter
from app import storage


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def isolated_upload_dir(tmp_path, monkeypatch):
    """Uploads go to a per-test tmp dir, never the real backend/uploads/."""
    monkeypatch.setattr(storage, "UPLOAD_DIR", str(tmp_path))
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


FAKE_JPEG = ("photo.jpg", b"fake-jpeg-bytes", "image/jpeg")


def test_upload_nutrition_photo_sets_photo_url(client):
    token = register_login_and_create_profile(client, "photouser@example.com", "photouser")
    headers = {"Authorization": f"Bearer {token}"}

    food_response = client.post(
        "/foods",
        json={"name": "Test Food", "calories": 100, "protein": 10, "carbs": 10, "fat": 1},
        headers=headers,
    )
    food_id = food_response.json()["id"]

    log_response = client.post(
        "/nutrition",
        json={"food_id": food_id, "quantity_grams": 150},
        headers=headers,
    )
    log_id = log_response.json()["id"]
    assert log_response.json()["photo_url"] is None

    upload_response = client.post(
        f"/nutrition/{log_id}/photo",
        files={"file": FAKE_JPEG},
        headers=headers,
    )
    assert upload_response.status_code == 200
    body = upload_response.json()
    assert body["photo_url"] is not None
    assert body["photo_url"].startswith("/uploads/nutrition/")
    assert body["photo_url"].endswith(".jpg")

    # persisted, not just returned once
    list_response = client.get("/nutrition", headers=headers)
    assert list_response.json()[0]["photo_url"] == body["photo_url"]


def test_upload_nutrition_photo_rejects_bad_content_type(client):
    token = register_login_and_create_profile(client, "badtype@example.com", "badtypeuser")
    headers = {"Authorization": f"Bearer {token}"}

    food_response = client.post(
        "/foods",
        json={"name": "Test Food", "calories": 100, "protein": 10, "carbs": 10, "fat": 1},
        headers=headers,
    )
    food_id = food_response.json()["id"]
    log_response = client.post(
        "/nutrition", json={"food_id": food_id, "quantity_grams": 100}, headers=headers
    )
    log_id = log_response.json()["id"]

    response = client.post(
        f"/nutrition/{log_id}/photo",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_upload_nutrition_photo_ownership_404(client):
    token_a = register_login_and_create_profile(client, "photoowner_a@example.com", "photoownera")
    token_b = register_login_and_create_profile(client, "photoowner_b@example.com", "photoownerb")

    food_response = client.post(
        "/foods",
        json={"name": "Test Food", "calories": 100, "protein": 10, "carbs": 10, "fat": 1},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    food_id = food_response.json()["id"]
    log_response = client.post(
        "/nutrition",
        json={"food_id": food_id, "quantity_grams": 100},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    log_id = log_response.json()["id"]

    response = client.post(
        f"/nutrition/{log_id}/photo",
        files={"file": FAKE_JPEG},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 404


def test_progress_photo_upload_list_and_delete(client):
    token = register_login_and_create_profile(client, "progressphoto@example.com", "progressphotouser")
    headers = {"Authorization": f"Bearer {token}"}

    upload_response = client.post("/progress-photos", files={"file": FAKE_JPEG}, headers=headers)
    assert upload_response.status_code == 200
    body = upload_response.json()
    assert body["photo_url"].startswith("/uploads/progress/")

    list_response = client.get("/progress-photos", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["id"] == body["id"]

    delete_response = client.delete(f"/progress-photos/{body['id']}", headers=headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get("/progress-photos", headers=headers)
    assert list_after_delete.json() == []


def test_progress_photo_ownership(client):
    token_a = register_login_and_create_profile(client, "ppowner_a@example.com", "ppownera")
    token_b = register_login_and_create_profile(client, "ppowner_b@example.com", "ppownerb")

    upload_response = client.post(
        "/progress-photos", files={"file": FAKE_JPEG}, headers={"Authorization": f"Bearer {token_a}"}
    )
    photo_id = upload_response.json()["id"]

    # user B can't see or delete user A's photo
    list_response = client.get("/progress-photos", headers={"Authorization": f"Bearer {token_b}"})
    assert list_response.json() == []

    delete_response = client.delete(
        f"/progress-photos/{photo_id}", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert delete_response.status_code == 404
