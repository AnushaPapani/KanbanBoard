from fastapi.testclient import TestClient

from app.main import app, sessions


def make_client() -> TestClient:
    sessions.clear()
    return TestClient(app)


def test_login_rejects_wrong_credentials():
    client = make_client()
    response = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_unknown_username():
    client = make_client()
    response = client.post("/api/login", json={"username": "nobody", "password": "whatever"})
    assert response.status_code == 401


def test_login_accepts_demo_account_credentials():
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


def test_signup_creates_a_new_account_and_logs_them_in():
    client = make_client()
    response = client.post("/api/signup", json={"username": "newperson", "password": "hunter2"})
    assert response.status_code == 200
    assert response.json() == {"username": "newperson"}
    assert "session_token" in response.cookies

    me_response = client.get("/api/me")
    assert me_response.status_code == 200
    assert me_response.json() == {"username": "newperson"}


def test_signup_rejects_a_taken_username():
    client = make_client()
    response = client.post("/api/signup", json={"username": "user", "password": "whatever"})
    assert response.status_code == 409


def test_signup_new_user_gets_their_own_empty_board():
    client = make_client()
    client.post("/api/signup", json={"username": "newperson", "password": "hunter2"})
    board_id = client.get("/api/boards").json()[0]["id"]
    board = client.get(f"/api/boards/{board_id}").json()
    assert board["cards"] == {}
    assert [c["title"] for c in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]


def test_two_users_have_isolated_boards():
    alice = TestClient(app)
    alice.post("/api/signup", json={"username": "alice", "password": "alicepw"})
    alice_board_id = alice.get("/api/boards").json()[0]["id"]
    alice_backlog_id = next(
        c["id"]
        for c in alice.get(f"/api/boards/{alice_board_id}").json()["columns"]
        if c["title"] == "Backlog"
    )
    alice.post(
        f"/api/boards/{alice_board_id}/cards",
        json={"column_id": alice_backlog_id, "title": "Alice's card", "details": ""},
    )

    bob = TestClient(app)
    bob.post("/api/signup", json={"username": "bob", "password": "bobpw"})
    bob_board_id = bob.get("/api/boards").json()[0]["id"]
    bob_board = bob.get(f"/api/boards/{bob_board_id}").json()

    assert bob_board["cards"] == {}
