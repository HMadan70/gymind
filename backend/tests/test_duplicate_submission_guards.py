"""
Tests for Fix 2's backend-side duplicate-submission protection: add_set,
add_nutrition_log, and add_body_weight_log each detect an identical
resubmission within a short window (a bypassed frontend guard, or an
ordinary network retry after a timeout) and return the existing row
instead of inserting a second one.

The window is short and deliberately does NOT rely on real sleeping to
test its boundary - a row's created_at is backdated directly through the
ORM session to simulate "outside the window" instead.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app import models
from app.rate_limit import limiter
from app.routes.body_weight_routes import DUPLICATE_BODY_WEIGHT_LOG_WINDOW_SECONDS
from app.routes.nutrition_routes import DUPLICATE_NUTRITION_LOG_WINDOW_SECONDS
from app.routes.workout_routes import DUPLICATE_SET_WINDOW_SECONDS


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
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


# ---------------------------------------------------------------------------
# WorkoutSet (POST /workouts/{id}/sets)
# ---------------------------------------------------------------------------


def test_duplicate_set_within_window_returns_existing_row(client, db_session):
    token = register_login_and_create_profile(client, "dupset1@example.com", "dupset1user")
    headers = {"Authorization": f"Bearer {token}"}

    exercise_id = client.post(
        "/exercises", json={"name": "Squat", "muscle_group": "legs"}, headers=headers
    ).json()["id"]
    workout_id = client.post("/workouts", headers=headers).json()["id"]

    body = {"exercise_id": exercise_id, "set_number": 1, "weight": 135, "reps": 5}
    first = client.post(f"/workouts/{workout_id}/sets", json=body, headers=headers)
    second = client.post(f"/workouts/{workout_id}/sets", json=body, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    rows = db_session.query(models.WorkoutSet).filter(
        models.WorkoutSet.workout_id == workout_id
    ).all()
    assert len(rows) == 1


def test_set_after_window_creates_a_new_row(client, db_session):
    """
    Simulates a legitimate later resubmission (e.g. a second block of the
    same exercise added minutes later with the same numbers) rather than a
    same-request retry - the guard must not merge these.
    """
    token = register_login_and_create_profile(client, "dupset2@example.com", "dupset2user")
    headers = {"Authorization": f"Bearer {token}"}

    exercise_id = client.post(
        "/exercises", json={"name": "Bench Press", "muscle_group": "chest"}, headers=headers
    ).json()["id"]
    workout_id = client.post("/workouts", headers=headers).json()["id"]

    body = {"exercise_id": exercise_id, "set_number": 1, "weight": 135, "reps": 8}
    first = client.post(f"/workouts/{workout_id}/sets", json=body, headers=headers)
    assert first.status_code == 200

    # Backdate the row past the window instead of sleeping for it.
    row = db_session.query(models.WorkoutSet).filter(
        models.WorkoutSet.id == first.json()["id"]
    ).first()
    row.created_at = datetime.now(timezone.utc) - timedelta(
        seconds=DUPLICATE_SET_WINDOW_SECONDS + 1
    )
    db_session.commit()

    second = client.post(f"/workouts/{workout_id}/sets", json=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["id"] != first.json()["id"]

    rows = db_session.query(models.WorkoutSet).filter(
        models.WorkoutSet.workout_id == workout_id
    ).all()
    assert len(rows) == 2


def test_different_set_number_is_not_treated_as_duplicate(client, db_session):
    token = register_login_and_create_profile(client, "dupset3@example.com", "dupset3user")
    headers = {"Authorization": f"Bearer {token}"}

    exercise_id = client.post(
        "/exercises", json={"name": "Row", "muscle_group": "back"}, headers=headers
    ).json()["id"]
    workout_id = client.post("/workouts", headers=headers).json()["id"]

    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 100, "reps": 10},
        headers=headers,
    )
    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 2, "weight": 100, "reps": 10},
        headers=headers,
    )

    rows = db_session.query(models.WorkoutSet).filter(
        models.WorkoutSet.workout_id == workout_id
    ).all()
    assert len(rows) == 2


# ---------------------------------------------------------------------------
# NutritionLog (POST /nutrition)
# ---------------------------------------------------------------------------


def test_duplicate_nutrition_log_within_window_returns_existing_row(client, db_session):
    token = register_login_and_create_profile(client, "dupnutrition1@example.com", "dupnutrition1user")
    headers = {"Authorization": f"Bearer {token}"}

    food_id = client.post(
        "/foods",
        json={"name": "Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6},
        headers=headers,
    ).json()["id"]

    body = {"food_id": food_id, "quantity_grams": 150}
    first = client.post("/nutrition", json=body, headers=headers)
    second = client.post("/nutrition", json=body, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    rows = db_session.query(models.NutritionLog).filter(
        models.NutritionLog.user_id == first.json()["user_id"]
    ).all()
    assert len(rows) == 1


def test_nutrition_log_after_window_creates_a_new_row(client, db_session):
    """A second, real meal later in the day with the same food/quantity
    (e.g. the same breakfast two days running) must not be merged."""
    token = register_login_and_create_profile(client, "dupnutrition2@example.com", "dupnutrition2user")
    headers = {"Authorization": f"Bearer {token}"}

    food_id = client.post(
        "/foods",
        json={"name": "Rice", "calories": 130, "protein": 2.7, "carbs": 28, "fat": 0.3},
        headers=headers,
    ).json()["id"]

    body = {"food_id": food_id, "quantity_grams": 200}
    first = client.post("/nutrition", json=body, headers=headers)
    assert first.status_code == 200

    row = db_session.query(models.NutritionLog).filter(
        models.NutritionLog.id == first.json()["id"]
    ).first()
    row.created_at = datetime.now(timezone.utc) - timedelta(
        seconds=DUPLICATE_NUTRITION_LOG_WINDOW_SECONDS + 1
    )
    db_session.commit()

    second = client.post("/nutrition", json=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["id"] != first.json()["id"]


# ---------------------------------------------------------------------------
# BodyWeightLog (POST /body-weight)
# ---------------------------------------------------------------------------


def test_duplicate_body_weight_log_within_window_returns_existing_row(client, db_session):
    token = register_login_and_create_profile(client, "dupweight1@example.com", "dupweight1user")
    headers = {"Authorization": f"Bearer {token}"}

    body = {"weight": 180, "unit": "lb"}
    first = client.post("/body-weight", json=body, headers=headers)
    second = client.post("/body-weight", json=body, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    rows = db_session.query(models.BodyWeightLog).filter(
        models.BodyWeightLog.user_id == first.json()["user_id"]
    ).all()
    assert len(rows) == 1


def test_body_weight_log_after_window_creates_a_new_row(client, db_session):
    token = register_login_and_create_profile(client, "dupweight2@example.com", "dupweight2user")
    headers = {"Authorization": f"Bearer {token}"}

    body = {"weight": 175, "unit": "lb"}
    first = client.post("/body-weight", json=body, headers=headers)
    assert first.status_code == 200

    row = db_session.query(models.BodyWeightLog).filter(
        models.BodyWeightLog.id == first.json()["id"]
    ).first()
    row.created_at = datetime.now(timezone.utc) - timedelta(
        seconds=DUPLICATE_BODY_WEIGHT_LOG_WINDOW_SECONDS + 1
    )
    db_session.commit()

    second = client.post("/body-weight", json=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["id"] != first.json()["id"]


def test_different_weight_is_not_treated_as_duplicate(client, db_session):
    token = register_login_and_create_profile(client, "dupweight3@example.com", "dupweight3user")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/body-weight", json={"weight": 180, "unit": "lb"}, headers=headers)
    client.post("/body-weight", json={"weight": 179.5, "unit": "lb"}, headers=headers)

    rows = db_session.query(models.BodyWeightLog).all()
    assert len(rows) == 2
