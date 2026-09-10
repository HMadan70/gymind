"""
Tests for POST /coach's per-user rate limit (app/coach_rate_limit.py).

Never calls real OpenRouter - coach_service.request_completion is stubbed
in every test via the `stub_provider` fixture, same as test_coach.py. Time
is controlled by monkeypatching time.monotonic rather than real sleeping,
so these run in milliseconds regardless of the configured window.
"""
import pytest

from app import coach_rate_limit, coach_service
from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield


@pytest.fixture()
def stub_provider(monkeypatch):
    """Replaces the one function that performs network I/O - no test here
    ever calls real OpenRouter."""
    calls = []

    def fake_request_completion(messages):
        calls.append(messages)
        return "Stubbed coach reply."

    monkeypatch.setattr(coach_service, "request_completion", fake_request_completion)
    return calls


@pytest.fixture()
def fake_clock(monkeypatch):
    """Lets a test advance the rate limiter's clock without real sleeping."""
    state = {"now": 1_000_000.0}

    def fake_monotonic():
        return state["now"]

    monkeypatch.setattr(coach_rate_limit.time, "monotonic", fake_monotonic)

    def advance(seconds: float):
        state["now"] += seconds

    return advance


@pytest.fixture(autouse=True)
def small_limit(monkeypatch):
    """3 requests / 5 seconds - small enough to hit without a long test."""
    monkeypatch.setattr(coach_rate_limit, "REQUESTS", 3)
    monkeypatch.setattr(coach_rate_limit, "WINDOW_SECONDS", 5)
    coach_rate_limit._hits.clear()


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


def test_requests_below_limit_succeed(client, stub_provider, fake_clock):
    token = register_login_and_create_profile(client, "underlimit@example.com", "underlimituser")
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(3):
        response = client.post("/coach", json={"message": "hi"}, headers=headers)
        assert response.status_code == 200


def test_request_over_limit_returns_429_with_retry_after(client, stub_provider, fake_clock):
    token = register_login_and_create_profile(client, "overlimit@example.com", "overlimituser")
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(3):
        assert client.post("/coach", json={"message": "hi"}, headers=headers).status_code == 200

    fourth = client.post("/coach", json={"message": "hi"}, headers=headers)
    assert fourth.status_code == 429
    assert fourth.json()["detail"] == "Too many Coach requests. Please try again shortly."
    assert "Retry-After" in fourth.headers
    assert int(fourth.headers["Retry-After"]) > 0


def test_rejected_request_never_calls_the_llm_provider(client, stub_provider, fake_clock):
    token = register_login_and_create_profile(client, "noprovider@example.com", "noprovideruser")
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(3):
        client.post("/coach", json={"message": "hi"}, headers=headers)

    calls_before = len(stub_provider)
    response = client.post("/coach", json={"message": "hi"}, headers=headers)

    assert response.status_code == 429
    assert len(stub_provider) == calls_before, "rate-limited request must not reach the provider"


def test_rejected_request_creates_no_conversation_row(client, db_session, stub_provider, fake_clock):
    from app import models

    token = register_login_and_create_profile(client, "norow@example.com", "norowuser")
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(3):
        client.post("/coach", json={"message": "hi"}, headers=headers)

    conversations_before = db_session.query(models.CoachConversation).count()
    response = client.post("/coach", json={"message": "hi"}, headers=headers)

    assert response.status_code == 429
    assert db_session.query(models.CoachConversation).count() == conversations_before


def test_different_users_have_independent_limits(client, stub_provider, fake_clock):
    token_a = register_login_and_create_profile(client, "usera@example.com", "userarl")
    token_b = register_login_and_create_profile(client, "userb@example.com", "userbrl")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    for _ in range(3):
        assert client.post("/coach", json={"message": "hi"}, headers=headers_a).status_code == 200
    assert client.post("/coach", json={"message": "hi"}, headers=headers_a).status_code == 429

    # User B's budget is untouched by user A's usage.
    assert client.post("/coach", json={"message": "hi"}, headers=headers_b).status_code == 200


def test_unauthenticated_request_still_rejected_normally(client):
    response = client.post("/coach", json={"message": "hi"})
    assert response.status_code == 401


def test_limit_recovers_after_window_expiry(client, stub_provider, fake_clock):
    token = register_login_and_create_profile(client, "recovers@example.com", "recoversuser")
    headers = {"Authorization": f"Bearer {token}"}

    for _ in range(3):
        assert client.post("/coach", json={"message": "hi"}, headers=headers).status_code == 200
    assert client.post("/coach", json={"message": "hi"}, headers=headers).status_code == 429

    # Advance the fake clock past the 5-second window - no real waiting.
    fake_clock(5.1)

    assert client.post("/coach", json={"message": "hi"}, headers=headers).status_code == 200


def test_rate_limit_check_raises_before_any_db_or_provider_work(monkeypatch):
    """
    Unit-level check on the limiter function itself: at the configured
    boundary it raises HTTPException(429) with a Retry-After header, and it
    does so synchronously - callers that check this first (as the route
    does) can never reach a DB write or provider call on a rejected call.
    """
    monkeypatch.setattr(coach_rate_limit, "REQUESTS", 1)
    monkeypatch.setattr(coach_rate_limit, "WINDOW_SECONDS", 60)
    coach_rate_limit._hits.clear()

    coach_rate_limit.check_coach_rate_limit(999)

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as excinfo:
        coach_rate_limit.check_coach_rate_limit(999)

    assert excinfo.value.status_code == 429
    assert "Retry-After" in excinfo.value.headers
