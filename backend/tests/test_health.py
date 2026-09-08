from unittest.mock import patch


def test_liveness_health_check(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_check_does_not_expose_exception_details(client):
    with patch("app.main.engine.connect", side_effect=RuntimeError("sensitive connection detail")):
        response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
    assert "sensitive" not in response.text
