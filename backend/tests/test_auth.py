from fastapi.testclient import TestClient

from app.main import app, sessions


def make_client() -> TestClient:
    sessions.clear()
    return TestClient(app)


def test_login_rejects_wrong_credentials():
    client = make_client()
    response = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401


def test_login_accepts_hardcoded_credentials():
    client = make_client()
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "session_token" in response.cookies


def test_me_requires_authentication():
    client = make_client()
    response = client.get("/api/me")
    assert response.status_code == 401


def test_me_reflects_logged_in_session():
    client = make_client()
    client.post("/api/login", json={"username": "user", "password": "password"})
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_clears_session():
    client = make_client()
    client.post("/api/login", json={"username": "user", "password": "password"})
    logout_response = client.post("/api/logout")
    assert logout_response.status_code == 200

    me_response = client.get("/api/me")
    assert me_response.status_code == 401
