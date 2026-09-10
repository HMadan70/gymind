import pytest

from app.rate_limit import limiter


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


def test_progress_overview_requires_profile(client):
    client.post(
        "/auth/register",
        json={
            "email": "progressnoprofile@example.com",
            "username": "progressnoprofile",
            "password": "TestPass123!",
        },
    )
    login = client.post(
        "/auth/login",
        json={"identifier": "progressnoprofile", "password": "TestPass123!"},
    )
    token = login.json()["access_token"]

    response = client.get(
        "/progress", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_progress_overview_is_empty_for_a_new_user(client):
    token = register_login_and_create_profile(
        client, "progressempty@example.com", "progressemptyuser"
    )
    response = client.get(
        "/progress", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["body_weight"]["entries"] == []
    assert body["exercises"] == []
    assert body["muscle_groups"] == []
    assert body["consistency"] == {"days_trained": 0, "total_days": 28}


def test_progress_overview_aggregates_logged_data(client):
    token = register_login_and_create_profile(
        client, "progressdata@example.com", "progressdatauser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_id = client.post(
        "/exercises",
        json={"name": "Back Squat", "muscle_group": "legs"},
        headers=headers,
    ).json()["id"]

    workout_id = client.post("/workouts", json={}, headers=headers).json()["id"]
    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 100.0, "reps": 5},
        headers=headers,
    )
    client.post("/body-weight", json={"weight": 80.0, "unit": "kg"}, headers=headers)

    response = client.get("/progress", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["body_weight"]["unit"] == "kg"
    assert len(body["body_weight"]["entries"]) == 1

    assert len(body["exercises"]) == 1
    exercise = body["exercises"][0]
    assert exercise["exercise_name"] == "Back Squat"
    # Epley: 100 * (1 + 5/30) = 116.7
    assert exercise["entries"][0]["e1rm"] == pytest.approx(116.7)

    assert body["muscle_groups"] == [
        {"muscle_group": "legs", "best_e1rm": pytest.approx(116.7)}
    ]


def test_progress_overview_respects_days_parameter(client):
    token = register_login_and_create_profile(
        client, "progressdays@example.com", "progressdaysuser"
    )
    response = client.get(
        "/progress?days=7", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["consistency"]["total_days"] == 7
