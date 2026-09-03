import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as test_auth.py and test_workouts.py: the helper
    # below calls /auth/register and /auth/login for every test, and
    # slowapi's limiter state isn't reset per test on its own.
    limiter.reset()
    yield


def register_login_and_create_profile(client, email, username, password="TestPass123!"):
    """
    Duplicated from test_workouts.py rather than shared, matching this
    project's existing preference for each test file staying fully
    self-contained (see test_nutrition_targets.py's copy of the same
    helper for precedent).
    """
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


def test_favorite_and_unfavorite_exercise(client):
    token = register_login_and_create_profile(
        client, "favoriteflow@example.com", "favoriteflowuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Deadlift", "muscle_group": "back"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]
    assert exercise_response.json()["is_favorited"] is False

    favorite_response = client.post(f"/exercises/{exercise_id}/favorite", headers=headers)
    assert favorite_response.status_code == 200
    assert favorite_response.json()["exercise_id"] == exercise_id

    list_response = client.get("/exercises", headers=headers)
    favorited = next(e for e in list_response.json() if e["id"] == exercise_id)
    assert favorited["is_favorited"] is True

    unfavorite_response = client.delete(f"/exercises/{exercise_id}/favorite", headers=headers)
    assert unfavorite_response.status_code == 204

    list_response = client.get("/exercises", headers=headers)
    unfavorited = next(e for e in list_response.json() if e["id"] == exercise_id)
    assert unfavorited["is_favorited"] is False


def test_duplicate_favorite_returns_409(client):
    token = register_login_and_create_profile(
        client, "duplicatefavorite@example.com", "duplicatefavoriteuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Overhead Press", "muscle_group": "shoulders"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    first = client.post(f"/exercises/{exercise_id}/favorite", headers=headers)
    assert first.status_code == 200

    second = client.post(f"/exercises/{exercise_id}/favorite", headers=headers)
    assert second.status_code == 409
    assert second.json()["detail"] == "Exercise already favorited"


def test_favorite_nonexistent_exercise_returns_404(client):
    token = register_login_and_create_profile(
        client, "missingexercise@example.com", "missingexerciseuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/exercises/999999/favorite", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Exercise not found"


def test_favorites_only_returns_only_favorited_exercises(client):
    token = register_login_and_create_profile(
        client, "favoritesonly@example.com", "favoritesonlyuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    favorited = client.post(
        "/exercises",
        json={"name": "Pull Up", "muscle_group": "back"},
        headers=headers,
    ).json()
    client.post(
        "/exercises",
        json={"name": "Leg Press", "muscle_group": "legs"},
        headers=headers,
    )

    client.post(f"/exercises/{favorited['id']}/favorite", headers=headers)

    response = client.get("/exercises?favorites_only=true", headers=headers)
    assert response.status_code == 200

    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == favorited["id"]
    assert results[0]["is_favorited"] is True
