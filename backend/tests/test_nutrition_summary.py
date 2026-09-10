from datetime import datetime, timedelta, timezone

import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as the other test files: the helper below calls
    # /auth/register and /auth/login for every test, and slowapi's limiter
    # state lives on the shared app object rather than resetting per test.
    limiter.reset()
    yield


def register_login_and_create_profile(client, email, username, password="TestPass123!"):
    """
    Local copy for the same reason test_nutrition_targets.py keeps one:
    each test file stays self-contained rather than sharing a helpers
    layer the app doesn't otherwise have.
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
        json={"goal": "build muscle"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


def make_food(client, headers, name="Test Food", calories=100, protein=10, carbs=20, fat=5):
    response = client.post(
        "/foods",
        json={
            "name": name,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fat": fat,
        },
        headers=headers,
    )
    return response.json()["id"]


def log_food(client, headers, food_id, grams, logged_at=None):
    payload = {"food_id": food_id, "quantity_grams": grams}
    if logged_at is not None:
        payload["logged_at"] = logged_at.isoformat()
    return client.post("/nutrition", json=payload, headers=headers)


def test_summary_defaults_to_today_and_excludes_other_days(client):
    token = register_login_and_create_profile(client, "sumtoday@example.com", "sumtodayuser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    now = datetime.now(timezone.utc)
    log_food(client, headers, food_id, 200, now)               # today  -> counts
    log_food(client, headers, food_id, 500, now - timedelta(days=3))  # older -> excluded

    response = client.get("/nutrition/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    # 200g of a 100kcal/100g food = 200 kcal. The 3-day-old 500g entry
    # would add another 500 kcal if the day filter weren't applied.
    assert body["total_calories"] == 200.0
    assert body["total_protein"] == 20.0
    assert body["date"] == now.date().isoformat()


def test_summary_accepts_an_explicit_date(client):
    token = register_login_and_create_profile(client, "sumdate@example.com", "sumdateuser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    now = datetime.now(timezone.utc)
    target_day = now - timedelta(days=2)
    log_food(client, headers, food_id, 300, target_day)
    log_food(client, headers, food_id, 100, now)

    response = client.get(
        f"/nutrition/summary?date={target_day.date().isoformat()}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_calories"] == 300.0
    assert body["date"] == target_day.date().isoformat()


def test_summary_is_zero_for_a_day_with_no_logs(client):
    token = register_login_and_create_profile(client, "sumempty@example.com", "sumemptyuser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)
    log_food(client, headers, food_id, 250, datetime.now(timezone.utc))

    empty_day = (datetime.now(timezone.utc) - timedelta(days=10)).date().isoformat()
    response = client.get(f"/nutrition/summary?date={empty_day}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_calories"] == 0
    assert body["total_protein"] == 0
    assert body["total_carbs"] == 0
    assert body["total_fat"] == 0


def test_summary_only_counts_the_requesting_user(client):
    token_a = register_login_and_create_profile(client, "sumowner@example.com", "sumowneruser")
    token_b = register_login_and_create_profile(client, "sumother@example.com", "sumotheruser")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    food_id = make_food(client, headers_a)
    log_food(client, headers_a, food_id, 400, datetime.now(timezone.utc))

    response = client.get("/nutrition/summary", headers=headers_b)

    assert response.status_code == 200
    assert response.json()["total_calories"] == 0


def test_summary_date_all_returns_every_log(client):
    token = register_login_and_create_profile(client, "sumall@example.com", "sumalluser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    now = datetime.now(timezone.utc)
    log_food(client, headers, food_id, 200, now)                      # today
    log_food(client, headers, food_id, 500, now - timedelta(days=3))  # older
    log_food(client, headers, food_id, 300, now - timedelta(days=40)) # much older

    today_response = client.get("/nutrition/summary", headers=headers)
    all_response = client.get("/nutrition/summary?date=all", headers=headers)

    assert today_response.status_code == 200
    assert all_response.status_code == 200

    # The default stays scoped to today...
    assert today_response.json()["total_calories"] == 200.0
    # ...while ?date=all restores the pre-date-param behaviour of summing
    # every log ever: (200 + 500 + 300)g of a 100kcal/100g food.
    assert all_response.json()["total_calories"] == 1000.0
    assert all_response.json()["total_protein"] == 100.0
    assert all_response.json()["date"] == "all"


def test_summary_rejects_a_malformed_date(client):
    token = register_login_and_create_profile(client, "sumbad@example.com", "sumbaduser")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/nutrition/summary?date=not-a-date", headers=headers)

    # FastAPI validates the date query param before the route body runs.
    assert response.status_code == 422
