import pytest

from app import coach_service, models
from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    # Same reasoning as test_workouts.py: the helper below calls
    # /auth/register and /auth/login for every test, and slowapi's limiter
    # state lives on the shared `app` object rather than resetting per test.
    limiter.reset()
    yield


@pytest.fixture()
def stub_provider(monkeypatch):
    """
    Replace the one function that performs network I/O. Every test in this
    file exercises the route and prompt logic, never a real provider call.
    """
    calls = []

    def fake_request_completion(messages):
        calls.append(messages)
        return "Stubbed coach reply."

    monkeypatch.setattr(coach_service, "request_completion", fake_request_completion)
    return calls


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
        json={"goal": "build strength"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


def test_coach_requires_authentication(client):
    response = client.post("/coach", json={"message": "Hello"})
    assert response.status_code == 401


def test_coach_requires_completed_profile(client, stub_provider):
    client.post(
        "/auth/register",
        json={
            "email": "noprofile@example.com",
            "username": "noprofileuser",
            "password": "TestPass123!",
        },
    )
    login = client.post(
        "/auth/login",
        json={"identifier": "noprofileuser", "password": "TestPass123!"},
    )
    token = login.json()["access_token"]

    response = client.post(
        "/coach",
        json={"message": "What should I train today?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_coach_creates_conversation_and_returns_reply(client, stub_provider):
    token = register_login_and_create_profile(
        client, "coach@example.com", "coachuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/coach",
        json={"message": "What should I train today?"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"]["content"] == "Stubbed coach reply."
    assert body["reply"]["role"] == "assistant"
    assert isinstance(body["conversation_id"], int)


def test_coach_prompt_includes_profile_data(client, stub_provider):
    token = register_login_and_create_profile(
        client, "context@example.com", "contextuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/coach", json={"message": "Hi"}, headers=headers)

    system_message = stub_provider[0][0]
    assert system_message["role"] == "system"
    assert "build strength" in system_message["content"]
    assert "contextuser" in system_message["content"]


def test_coach_replays_history_within_a_conversation(client, stub_provider):
    token = register_login_and_create_profile(
        client, "history@example.com", "historyuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/coach", json={"message": "First question"}, headers=headers)
    conversation_id = first.json()["conversation_id"]

    client.post(
        "/coach",
        json={"message": "Second question", "conversation_id": conversation_id},
        headers=headers,
    )

    second_call = stub_provider[1]
    contents = [m["content"] for m in second_call]
    assert "First question" in contents
    assert "Stubbed coach reply." in contents
    assert "Second question" in contents


def test_coach_rejects_another_users_conversation(client, stub_provider):
    owner_token = register_login_and_create_profile(
        client, "owner@example.com", "owneruser"
    )
    owner_conversation = client.post(
        "/coach",
        json={"message": "Mine"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()["conversation_id"]

    intruder_token = register_login_and_create_profile(
        client, "intruder@example.com", "intruderuser"
    )
    response = client.post(
        "/coach",
        json={"message": "Yours", "conversation_id": owner_conversation},
        headers={"Authorization": f"Bearer {intruder_token}"},
    )
    assert response.status_code == 404


def test_coach_returns_503_and_stores_nothing_when_provider_fails(
    client, db_session, monkeypatch
):
    def failing_request(messages):
        raise coach_service.CoachUnavailable("no api key")

    monkeypatch.setattr(coach_service, "request_completion", failing_request)

    token = register_login_and_create_profile(
        client, "outage@example.com", "outageuser"
    )
    response = client.post(
        "/coach",
        json={"message": "Are you there?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 503
    # The user's turn must not survive a failed reply, or the next request
    # would replay an unanswered question as history.
    assert db_session.query(models.CoachMessage).count() == 0
    assert db_session.query(models.CoachConversation).count() == 0


def test_coach_conversation_listing_and_messages(client, stub_provider):
    token = register_login_and_create_profile(
        client, "listing@example.com", "listinguser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    conversation_id = client.post(
        "/coach", json={"message": "Programming advice"}, headers=headers
    ).json()["conversation_id"]

    conversations = client.get("/coach/conversations", headers=headers)
    assert conversations.status_code == 200
    assert len(conversations.json()) == 1
    assert conversations.json()[0]["title"] == "Programming advice"

    messages = client.get(
        f"/coach/conversations/{conversation_id}", headers=headers
    )
    assert messages.status_code == 200
    assert [m["role"] for m in messages.json()] == ["user", "assistant"]


def test_coach_conversation_delete_removes_messages(client, db_session, stub_provider):
    token = register_login_and_create_profile(
        client, "delete@example.com", "deleteuser"
    )
    headers = {"Authorization": f"Bearer {token}"}

    conversation_id = client.post(
        "/coach", json={"message": "Temporary"}, headers=headers
    ).json()["conversation_id"]

    response = client.delete(
        f"/coach/conversations/{conversation_id}", headers=headers
    )
    assert response.status_code == 204
    assert db_session.query(models.CoachMessage).count() == 0
    assert db_session.query(models.CoachConversation).count() == 0


def test_coach_rejects_blank_message(client, stub_provider):
    token = register_login_and_create_profile(
        client, "blank@example.com", "blankuser"
    )
    response = client.post(
        "/coach",
        json={"message": "   "},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_request_completion_without_api_key_raises(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(coach_service.CoachUnavailable):
        coach_service.request_completion([{"role": "user", "content": "hi"}])
