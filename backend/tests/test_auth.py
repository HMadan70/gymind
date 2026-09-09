import pytest

from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # /auth/register and /auth/login are rate-limited (5/min per IP, see
    # PROJECT_STATUS.md Section 10). slowapi's limiter state lives on the
    # shared `app` object, which conftest.py imports once for the whole
    # test session - unlike the DB, it isn't reset per test on its own.
    # Without this, tests further into the file start tripping 429s from
    # earlier tests' register/login calls, since the TestClient always
    # looks like the same "IP" to the limiter. Reset before every test so
    # each one gets a fresh 5-request budget, independent of test order.
    limiter.reset()
    yield


def test_register_creates_user(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "TestPass123!",
        },
    )

    # POST /auth/register doesn't set an explicit status_code, so FastAPI
    # uses its default of 200 (not 201) for this route.
    assert response.status_code == 200

    body = response.json()
    assert body["email"] == "newuser@example.com"
    assert body["username"] == "newuser"
    assert "id" in body
    assert "password_hash" not in body  # never sent back to the client



def test_login_returns_token(client):
    # Step 1: register a user first, since login needs one to already exist
    client.post(
        "/auth/register",
        json={
            "email": "loginuser@example.com",
            "username": "loginuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: now try logging in as that user
    response = client.post(
        "/auth/login",
        json={
            "identifier": "loginuser",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 200

    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"



def test_login_wrong_password_fails(client):
    # Step 1: register a user first, since login needs one to already exist
    client.post(
        "/auth/register",
        json={
            "email": "loginuser@example.com",
            "username": "loginuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: try logging in with the wrong password
    response = client.post(
        "/auth/login",
        json={
            "identifier": "loginuser",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401

    body = response.json()
    assert body["detail"] == "Invalid credentials"



def test_register_duplicate_email_fails(client):
    # Step 1: register the first user
    client.post(
        "/auth/register",
        json={
            "email": "dupe@example.com",
            "username": "firstuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: try registering a second user with the same email, different username
    response = client.post(
        "/auth/register",
        json={
            "email": "dupe@example.com",
            "username": "seconduser",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 400

    body = response.json()
    assert body["detail"] == "Email or username already registered"



def test_register_duplicate_username_fails(client):
    # Step 1: register the first user
    client.post(
        "/auth/register",
        json={
            "email": "first@example.com",
            "username": "dupeuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: try registering a second user with the same username, different email
    response = client.post(
        "/auth/register",
        json={
            "email": "second@example.com",
            "username": "dupeuser",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 400

    body = response.json()
    assert body["detail"] == "Email or username already registered"



def test_register_missing_fields_fails(client):
    # No password field at all - Pydantic should reject this before it
    # ever reaches the route body, so this must never surface as a 500.
    response = client.post(
        "/auth/register",
        json={
            "email": "incomplete@example.com",
            "username": "incompleteuser",
        },
    )

    assert response.status_code == 422

    body = response.json()
    missing_fields = [error["loc"][-1] for error in body["detail"]]
    assert "password" in missing_fields


@pytest.mark.parametrize(
    ("username", "password"),
    [
        ("ab", "TestPass123!"),
        ("invalid name", "TestPass123!"),
        ("valid-user", "short"),
    ],
)
def test_register_rejects_invalid_credentials(client, username, password):
    response = client.post(
        "/auth/register",
        json={
            "email": "validation@example.com",
            "username": username,
            "password": password,
        },
    )

    assert response.status_code == 422



def test_get_current_user_rejects_invalid_token(client):
    response = client.get(
        "/users/me",
        headers={"Authorization": "Bearer this-is-not-a-real-token"},
    )

    assert response.status_code == 401

    body = response.json()
    assert body["detail"] == "Could not validate credentials"



def test_get_current_user_rejects_missing_token(client):
    response = client.get("/users/me")

    # No Authorization header at all - FastAPI's OAuth2PasswordBearer
    # rejects this itself, before get_current_user's body ever runs.
    assert response.status_code == 401

    body = response.json()
    assert body["detail"] == "Not authenticated"



def test_get_current_user_works_with_valid_token(client):
    # Step 1: register a user
    client.post(
        "/auth/register",
        json={
            "email": "validtoken@example.com",
            "username": "validtokenuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: log in to get a real token
    login_response = client.post(
        "/auth/login",
        json={
            "identifier": "validtokenuser",
            "password": "TestPass123!",
        },
    )
    token = login_response.json()["access_token"]

    # Step 3: use that token to call GET /users/me
    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200

    body = response.json()
    assert body["email"] == "validtoken@example.com"
    assert body["username"] == "validtokenuser"



def test_require_profile_blocks_without_profile(client):
    # Step 1: register a user
    client.post(
        "/auth/register",
        json={
            "email": "noprofile@example.com",
            "username": "noprofileuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: log in, but never create a profile
    login_response = client.post(
        "/auth/login",
        json={
            "identifier": "noprofileuser",
            "password": "TestPass123!",
        },
    )
    token = login_response.json()["access_token"]

    # Step 3: hit a require_profile-gated route
    response = client.get(
        "/users/onboarding-check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403

    body = response.json()
    assert body["detail"] == "Profile setup required before accessing this feature."



def test_require_profile_allows_with_profile(client):
    # Step 1: register a user
    client.post(
        "/auth/register",
        json={
            "email": "hasprofile@example.com",
            "username": "hasprofileuser",
            "password": "TestPass123!",
        },
    )

    # Step 2: log in
    login_response = client.post(
        "/auth/login",
        json={
            "identifier": "hasprofileuser",
            "password": "TestPass123!",
        },
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Step 3: create a profile
    client.post(
        "/users/profile",
        json={"goal": "build muscle"},
        headers=headers,
    )

    # Step 4: the same require_profile-gated route should now succeed
    response = client.get("/users/onboarding-check", headers=headers)

    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "profile complete"


def _expired_token(user_id: int) -> str:
    """
    A structurally valid token whose `exp` is already in the past. Built here
    rather than by waiting out ACCESS_TOKEN_EXPIRE_MINUTES (seven days).
    """
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app import auth

    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    return jwt.encode(payload, auth.JWT_SECRET, algorithm=auth.JWT_ALGORITHM)


def test_expired_token_is_rejected(client, db_session):
    """
    Expiry is what eventually forces a re-login, so a stale token must fail
    closed. The app's authFetch clears the session on 401, which is what
    bounces the user back to the login screen.
    """
    from app import models

    client.post(
        "/auth/register",
        json={
            "email": "expired@example.com",
            "username": "expireduser",
            "password": "TestPass123!",
        },
    )
    user = db_session.query(models.User).filter(
        models.User.username == "expireduser"
    ).first()

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {_expired_token(user.id)}"},
    )
    assert response.status_code == 401


def test_token_for_a_deleted_user_is_rejected(client, db_session):
    """
    The closest server-side equivalent of a revoked session: the token still
    verifies cryptographically, but the subject no longer exists.
    """
    from app import models

    client.post(
        "/auth/register",
        json={
            "email": "gone@example.com",
            "username": "goneuser",
            "password": "TestPass123!",
        },
    )
    token = client.post(
        "/auth/login",
        json={"identifier": "goneuser", "password": "TestPass123!"},
    ).json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/users/me", headers=headers).status_code == 200

    db_session.query(models.User).filter(
        models.User.username == "goneuser"
    ).delete(synchronize_session=False)
    db_session.commit()

    assert client.get("/users/me", headers=headers).status_code == 401


def test_full_auth_journey_register_to_authenticated_use(client):
    """
    End-to-end walk of the flow the app performs on a fresh install:
    register, then the onboarding guard rejects until a profile exists,
    then the same token works. Mirrors checkOnboarding.tsx's sequence.
    """
    register = client.post(
        "/auth/register",
        json={
            "email": "journey@example.com",
            "username": "journeyuser",
            "password": "TestPass123!",
        },
    )
    assert register.status_code == 200
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Registration alone must not satisfy the profile gate.
    assert client.get("/users/onboarding-check", headers=headers).status_code == 403

    client.post("/users/profile", json={"goal": "get stronger"}, headers=headers)
    assert client.get("/users/onboarding-check", headers=headers).status_code == 200

    # Logging in again issues a token that is equally usable - the app holds
    # exactly one token at a time, so a re-login must fully replace it.
    relogin_token = client.post(
        "/auth/login",
        json={"identifier": "journeyuser", "password": "TestPass123!"},
    ).json()["access_token"]
    assert (
        client.get(
            "/users/me", headers={"Authorization": f"Bearer {relogin_token}"}
        ).status_code
        == 200
    )
