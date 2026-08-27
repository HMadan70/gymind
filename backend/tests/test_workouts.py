import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as test_auth.py: these tests don't hit rate-limited
    # routes directly, but the helper below calls /auth/register and
    # /auth/login for every test, and slowapi's limiter state lives on
    # the shared `app` object rather than being reset per test. Without
    # this, tests further into the file (or the two-user test, which
    # calls register/login twice) start tripping 429s from earlier
    # tests' calls.
    limiter.reset()
    yield


def register_login_and_create_profile(client, email, username, password="TestPass123!"):
    """
    Most workout routes use require_profile, so nearly every test here
    needs a logged-in user who's already completed onboarding. This
    collapses that three-call boilerplate (register, login, create
    profile) into one helper and returns just the auth token, matching
    how test_auth.py's tests build `headers` themselves from a token.
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


def test_cannot_log_set_on_finished_workout(client):
    token = register_login_and_create_profile(
        client, "finishedworkout@example.com", "finishedworkoutuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # exercises table starts empty per test (create_all() only builds
    # schema, no seed data) - create one to log a set against
    exercise_response = client.post(
        "/exercises",
        json={"name": "Bench Press", "muscle_group": "chest"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    workout_response = client.post("/workouts", headers=headers)
    workout_id = workout_response.json()["id"]

    # finish the workout before trying to log anything against it
    client.put(f"/workouts/{workout_id}", headers=headers)

    response = client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 135, "reps": 8},
        headers=headers,
    )

    assert response.status_code == 409

    body = response.json()
    assert body["detail"] == "Cannot add a set to a finished workout session"


def test_can_log_set_on_active_workout(client):
    token = register_login_and_create_profile(
        client, "activeworkout@example.com", "activeworkoutuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Squat", "muscle_group": "legs"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    workout_response = client.post("/workouts", headers=headers)
    workout_id = workout_response.json()["id"]

    # don't finish it - log a set while it's still active
    response = client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 185, "reps": 5},
        headers=headers,
    )

    # POST /workouts/{id}/sets doesn't set an explicit status_code, so
    # FastAPI uses its default of 200 (not 201) for this route.
    assert response.status_code == 200

    body = response.json()
    assert body["exercise_id"] == exercise_id
    assert body["set_number"] == 1
    assert body["weight"] == 185
    assert body["reps"] == 5
    assert body["exercise"]["name"] == "Squat"
    assert body["exercise"]["muscle_group"] == "legs"


def test_cannot_access_another_users_workout(client):
    token_a = register_login_and_create_profile(client, "usera@example.com", "usera")
    token_b = register_login_and_create_profile(client, "userb@example.com", "userb")

    workout_response = client.post(
        "/workouts", headers={"Authorization": f"Bearer {token_a}"}
    )
    workout_id = workout_response.json()["id"]

    # user B tries to read user A's workout
    response = client.get(
        f"/workouts/{workout_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    # ownership is enforced as a 404 (not found), not a 403 - same
    # not-found-if-not-yours convention used across the app
    assert response.status_code == 404

    body = response.json()
    assert body["detail"] == "Workout not found"
