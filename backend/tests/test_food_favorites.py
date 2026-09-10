import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as test_favorites.py: the helper below calls
    # /auth/register and /auth/login for every test, and slowapi's limiter
    # state isn't reset per test on its own.
    limiter.reset()
    yield


def register_login_and_create_profile(client, email, username, password="TestPass123!"):
    """
    Duplicated rather than shared, matching this project's existing
    preference for each test file staying fully self-contained (see
    test_favorites.py / test_nutrition_targets.py for precedent).
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


def make_food(client, headers, name="Test Food"):
    response = client.post(
        "/foods",
        json={"name": name, "calories": 100, "protein": 10, "carbs": 20, "fat": 5},
        headers=headers,
    )
    return response.json()["id"]


def test_favorite_and_unfavorite_food(client):
    token = register_login_and_create_profile(client, "favfood@example.com", "favfooduser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    # not favorited to begin with
    listing = client.get("/foods", headers=headers).json()
    assert [f["is_favorited"] for f in listing if f["id"] == food_id] == [False]

    favorite_response = client.post(f"/foods/{food_id}/favorite", headers=headers)
    assert favorite_response.status_code == 200
    body = favorite_response.json()
    assert body["food_id"] == food_id

    listing = client.get("/foods", headers=headers).json()
    assert [f["is_favorited"] for f in listing if f["id"] == food_id] == [True]

    unfavorite_response = client.delete(f"/foods/{food_id}/favorite", headers=headers)
    assert unfavorite_response.status_code == 204

    listing = client.get("/foods", headers=headers).json()
    assert [f["is_favorited"] for f in listing if f["id"] == food_id] == [False]


def test_duplicate_favorite_returns_409(client):
    token = register_login_and_create_profile(client, "favdup@example.com", "favdupuser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    client.post(f"/foods/{food_id}/favorite", headers=headers)
    response = client.post(f"/foods/{food_id}/favorite", headers=headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Food already favorited"


def test_favorite_nonexistent_food_returns_404(client):
    token = register_login_and_create_profile(client, "favmissing@example.com", "favmissinguser")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/foods/999999/favorite", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Food not found"


def test_cannot_favorite_or_log_another_users_private_food(client):
    owner_token = register_login_and_create_profile(client, "foodowner@example.com", "foodowner")
    other_token = register_login_and_create_profile(client, "foodother@example.com", "foodother")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}
    food_id = make_food(client, owner_headers, name="Owner's recipe")

    favorite = client.post(f"/foods/{food_id}/favorite", headers=other_headers)
    log = client.post(
        "/nutrition",
        json={"food_id": food_id, "quantity_grams": 100},
        headers=other_headers,
    )

    assert favorite.status_code == 404
    assert log.status_code == 404
    assert favorite.json()["detail"] == "Food not found"
    assert log.json()["detail"] == "Food not found"


def test_unfavorite_when_not_favorited_returns_404(client):
    token = register_login_and_create_profile(client, "favnone@example.com", "favnoneuser")
    headers = {"Authorization": f"Bearer {token}"}
    food_id = make_food(client, headers)

    response = client.delete(f"/foods/{food_id}/favorite", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Favorite not found"


def test_favorites_only_returns_only_favorited_foods(client):
    token = register_login_and_create_profile(client, "favonly@example.com", "favonlyuser")
    headers = {"Authorization": f"Bearer {token}"}
    favorited_id = make_food(client, headers, name="Favorited Food")
    other_id = make_food(client, headers, name="Other Food")

    client.post(f"/foods/{favorited_id}/favorite", headers=headers)

    response = client.get("/foods?favorites_only=true", headers=headers)

    assert response.status_code == 200
    returned_ids = [f["id"] for f in response.json()]
    assert favorited_id in returned_ids
    assert other_id not in returned_ids
    assert all(f["is_favorited"] for f in response.json())


def test_favorites_are_per_user(client):
    """
    The point of the join table over an is_favorite column: foods is a
    shared table, so one user favoriting a food must not change what
    anyone else sees.
    """
    token_a = register_login_and_create_profile(client, "favmine@example.com", "favmineuser")
    token_b = register_login_and_create_profile(client, "favtheirs@example.com", "favtheirsuser")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # user A's own food, favorited by A
    food_id = make_food(client, headers_a, name="A's Food")
    client.post(f"/foods/{food_id}/favorite", headers=headers_a)

    # A sees it favorited
    a_listing = client.get("/foods", headers=headers_a).json()
    assert [f["is_favorited"] for f in a_listing if f["id"] == food_id] == [True]

    # B has no favorites of their own
    assert client.get("/foods?favorites_only=true", headers=headers_b).json() == []


def test_unfiltered_foods_listing_is_capped(client):
    """
    GET /foods with neither `search` nor `favorites_only` is a "browse
    everything" call - with thousands of shared USDA rows in production,
    that must not come back unbounded. search and favorites_only stay
    uncapped (both are already naturally small), so this only exercises
    the plain listing.
    """
    from app.routes.nutrition_routes import DEFAULT_FOODS_LIMIT

    token = register_login_and_create_profile(client, "foodcap@example.com", "foodcapuser")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(DEFAULT_FOODS_LIMIT + 5):
        make_food(client, headers, name=f"Food {i}")

    unfiltered = client.get("/foods", headers=headers).json()
    assert len(unfiltered) == DEFAULT_FOODS_LIMIT

    # search and favorites_only are not subject to the cap
    searched = client.get("/foods?search=Food", headers=headers).json()
    assert len(searched) == DEFAULT_FOODS_LIMIT + 5
