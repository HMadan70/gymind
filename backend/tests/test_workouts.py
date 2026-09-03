from datetime import datetime, timedelta, timezone

import pytest

from app import models
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


def test_exercise_search_matches_prefix_only(client):
    token = register_login_and_create_profile(
        client, "prefixsearch@example.com", "prefixsearchuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/exercises",
        json={"name": "Bench Press", "muscle_group": "chest"},
        headers=headers,
    )
    # contains "ben" (inside "Bench"), but only in the middle of the
    # name, not at the start - a starts-with search for "ben" must not
    # match this, even though a "contains anywhere" search would
    client.post(
        "/exercises",
        json={"name": "Reverse Bench Press", "muscle_group": "chest"},
        headers=headers,
    )

    response = client.get("/exercises?search=ben", headers=headers)
    assert response.status_code == 200

    names = [exercise["name"] for exercise in response.json()]
    assert names == ["Bench Press"]


def test_exercise_filter_by_muscle_group_and_combined_with_search(client):
    token = register_login_and_create_profile(
        client, "musclegroupfilter@example.com", "musclegroupfilteruser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/exercises",
        json={"name": "Bench Press", "muscle_group": "chest"},
        headers=headers,
    )
    client.post(
        "/exercises",
        json={"name": "Incline Fly", "muscle_group": "chest"},
        headers=headers,
    )
    # starts with "Ben" too, same as "Bench Press", but in a different
    # muscle group - proves muscle_group and search combine as an AND,
    # not that search alone is doing the filtering
    client.post(
        "/exercises",
        json={"name": "Bent Over Row", "muscle_group": "back"},
        headers=headers,
    )

    group_only_response = client.get("/exercises?muscle_group=chest", headers=headers)
    assert group_only_response.status_code == 200
    group_only_names = {exercise["name"] for exercise in group_only_response.json()}
    assert group_only_names == {"Bench Press", "Incline Fly"}

    combined_response = client.get(
        "/exercises?muscle_group=chest&search=ben", headers=headers
    )
    assert combined_response.status_code == 200
    combined_names = [exercise["name"] for exercise in combined_response.json()]
    assert combined_names == ["Bench Press"]


def test_upsert_exercise_note_creates_then_updates(client):
    token = register_login_and_create_profile(
        client, "notehappy@example.com", "notehappyuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Leg Press", "muscle_group": "legs"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    workout_response = client.post("/workouts", headers=headers)
    workout_id = workout_response.json()["id"]

    # a note needs at least one logged set for that exercise to show up
    # in GET /workouts/{id}, since the note is nested under each set's
    # exercise object rather than returned as its own top-level list
    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 135, "reps": 10},
        headers=headers,
    )

    create_response = client.put(
        f"/workouts/{workout_id}/exercises/{exercise_id}/note",
        json={"note": "felt easy today"},
        headers=headers,
    )
    assert create_response.status_code == 200
    assert create_response.json()["note"] == "felt easy today"

    update_response = client.put(
        f"/workouts/{workout_id}/exercises/{exercise_id}/note",
        json={"note": "actually knee felt off"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["note"] == "actually knee felt off"
    # same note row updated, not a second one created
    assert update_response.json()["id"] == create_response.json()["id"]

    workout_detail = client.get(f"/workouts/{workout_id}", headers=headers).json()
    assert workout_detail["sets"][0]["exercise"]["note"] == "actually knee felt off"


def test_upsert_exercise_note_ownership_404(client):
    token_a = register_login_and_create_profile(client, "noteownera@example.com", "noteownera")
    token_b = register_login_and_create_profile(client, "noteownerb@example.com", "noteownerb")

    exercise_response = client.post(
        "/exercises",
        json={"name": "Hip Thrust", "muscle_group": "legs"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    exercise_id = exercise_response.json()["id"]

    workout_response = client.post(
        "/workouts", headers={"Authorization": f"Bearer {token_a}"}
    )
    workout_id = workout_response.json()["id"]

    # user B tries to attach a note to user A's workout
    response = client.put(
        f"/workouts/{workout_id}/exercises/{exercise_id}/note",
        json={"note": "sneaky"},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Workout not found"


def test_exercise_history_returns_previous_session_sets(client, db_session):
    token = register_login_and_create_profile(
        client, "historyhappy@example.com", "historyhappyuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Deadlift", "muscle_group": "back"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    workout_response = client.post("/workouts", headers=headers)
    workout_id = workout_response.json()["id"]

    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 1, "weight": 225, "reps": 5},
        headers=headers,
    )
    client.post(
        f"/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "set_number": 2, "weight": 245, "reps": 3},
        headers=headers,
    )

    client.put(f"/workouts/{workout_id}", headers=headers)

    # finish_workout stamps ended_at as "now" (today), but the route
    # under test only considers sessions finished before today - backdate
    # it directly through the ORM session to simulate yesterday, since
    # there's no API surface for backdating a finished workout.
    workout = db_session.query(models.UserWorkout).filter(
        models.UserWorkout.id == workout_id
    ).first()
    workout.ended_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    response = client.get(f"/exercises/{exercise_id}/history", headers=headers)
    assert response.status_code == 200

    body = response.json()
    assert body["previous_sets"] == [
        {"set_number": 1, "weight": 225.0, "reps": 5},
        {"set_number": 2, "weight": 245.0, "reps": 3},
    ]
    # highest prior weight (245) + 5
    assert body["suggested_target_weight"] == 250.0


def test_exercise_history_no_prior_session_returns_empty(client):
    token = register_login_and_create_profile(
        client, "historyempty@example.com", "historyemptyuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    exercise_response = client.post(
        "/exercises",
        json={"name": "Overhead Press", "muscle_group": "shoulders"},
        headers=headers,
    )
    exercise_id = exercise_response.json()["id"]

    # never logged before - this is a normal state for a new exercise,
    # not an error, so it's a 200 with empty results rather than a 404
    response = client.get(f"/exercises/{exercise_id}/history", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"previous_sets": [], "suggested_target_weight": None}


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
