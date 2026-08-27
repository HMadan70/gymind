import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as test_auth.py and test_workouts.py: the helper
    # below calls /auth/register and /auth/login for every test, and
    # slowapi's limiter state isn't reset per test on its own.
    limiter.reset()
    yield


def register_login_and_create_profile(client, email, username, goal, password="TestPass123!"):
    """
    Duplicated from test_workouts.py rather than shared, since that file
    was explicitly asked to define its own local helper - keeping this
    one local too means each test file stays fully self-contained and
    readable on its own, matching this project's existing preference for
    small, explicit code over shared abstractions (no services/helpers
    layer anywhere else in the app either). The only difference from
    test_workouts.py's version is that `goal` is a required argument
    here, since the targets calculation branches on it.
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
        json={"goal": goal},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


def test_targets_calculate_by_default(client):
    # "general fitness" matches none of calculate_targets()'s cut/bulk
    # keyword lists (lose/cut/fat loss/deficit/lean, gain/bulk/muscle/
    # mass/surplus), so it falls into the maintenance branch: 15 kcal/lb,
    # 1 g/lb protein, 0.35 g/lb fat (see nutrition_routes.py).
    token = register_login_and_create_profile(
        client, "targetscalc@example.com", "targetscalcuser", goal="general fitness"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # log a real body weight entry so the calculation has real data,
    # in a unit that needs no lb/kg conversion to keep the math simple
    client.post("/body-weight", json={"weight": 180, "unit": "lb"}, headers=headers)

    response = client.get("/nutrition/targets", headers=headers)

    assert response.status_code == 200
    body = response.json()

    assert body["is_manual"] is False

    weight_lb = 180.0
    assert body["target_calories"] == round(weight_lb * 15, 1)
    assert body["target_protein"] == round(weight_lb * 1.0, 1)
    assert body["target_fat"] == round(weight_lb * 0.35, 1)

    # target_carbs is documented as "whatever calories are left after
    # protein/fat, at 4 kcal/g" - verify that relationship holds against
    # the response's own numbers, rather than hardcoding a second
    # rounded literal that would just duplicate the app's rounding.
    remaining_calories = (
        body["target_calories"] - (body["target_protein"] * 4) - (body["target_fat"] * 9)
    )
    assert body["target_carbs"] == round(max(remaining_calories, 0) / 4, 1)


def test_targets_manual_override_persists(client):
    token = register_login_and_create_profile(
        client, "targetsmanual@example.com", "targetsmanualuser", goal="general fitness"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # GET first, so there's a calculated row to override
    client.get("/nutrition/targets", headers=headers)

    manual_values = {
        "target_calories": 2500,
        "target_protein": 190,
        "target_carbs": 250,
        "target_fat": 70,
    }
    put_response = client.put("/nutrition/targets", json=manual_values, headers=headers)

    assert put_response.status_code == 200
    put_body = put_response.json()
    assert put_body["is_manual"] is True
    assert put_body["target_calories"] == 2500
    assert put_body["target_protein"] == 190
    assert put_body["target_carbs"] == 250
    assert put_body["target_fat"] == 70

    # GET again - should return the same manual values, not recalculate
    get_response = client.get("/nutrition/targets", headers=headers)

    assert get_response.status_code == 200
    get_body = get_response.json()
    assert get_body["is_manual"] is True
    assert get_body["target_calories"] == 2500
    assert get_body["target_protein"] == 190
    assert get_body["target_carbs"] == 250
    assert get_body["target_fat"] == 70


def test_targets_reset_recalculates(client):
    token = register_login_and_create_profile(
        client, "targetsreset@example.com", "targetsresetuser", goal="general fitness"
    )
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/body-weight", json={"weight": 180, "unit": "lb"}, headers=headers)

    client.get("/nutrition/targets", headers=headers)
    client.put(
        "/nutrition/targets",
        json={
            "target_calories": 2500,
            "target_protein": 190,
            "target_carbs": 250,
            "target_fat": 70,
        },
        headers=headers,
    )

    reset_response = client.post("/nutrition/targets/reset", headers=headers)

    assert reset_response.status_code == 200
    reset_body = reset_response.json()
    assert reset_body["is_manual"] is False

    weight_lb = 180.0
    assert reset_body["target_calories"] == round(weight_lb * 15, 1)
    assert reset_body["target_protein"] == round(weight_lb * 1.0, 1)
    assert reset_body["target_fat"] == round(weight_lb * 0.35, 1)
    # none of the old manual values should have survived the reset
    assert reset_body["target_calories"] != 2500
    assert reset_body["target_protein"] != 190

    # GET again should match the reset (calculated) values
    get_response = client.get("/nutrition/targets", headers=headers)
    get_body = get_response.json()
    assert get_body["is_manual"] is False
    assert get_body["target_calories"] == reset_body["target_calories"]
    assert get_body["target_protein"] == reset_body["target_protein"]
    assert get_body["target_carbs"] == reset_body["target_carbs"]
    assert get_body["target_fat"] == reset_body["target_fat"]
