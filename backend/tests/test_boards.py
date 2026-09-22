from fastapi.testclient import TestClient

from app.main import app


def authenticated_client() -> TestClient:
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client


def test_new_user_starts_with_one_board():
    client = authenticated_client()
    response = client.get("/api/boards")
    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"


def test_create_a_second_board():
    client = authenticated_client()
    response = client.post("/api/boards", json={"name": "Marketing Launch"})
    assert response.status_code == 200
    assert response.json()["name"] == "Marketing Launch"

    boards = client.get("/api/boards").json()
    assert [b["name"] for b in boards] == ["My Board", "Marketing Launch"]


def test_new_board_has_its_own_seed_columns_and_no_cards():
    client = authenticated_client()
    new_board = client.post("/api/boards", json={"name": "Second board"}).json()

    board = client.get(f"/api/boards/{new_board['id']}").json()
    assert [c["title"] for c in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert board["cards"] == {}


def test_cards_are_isolated_between_a_users_own_boards():
    client = authenticated_client()
    first_board_id = client.get("/api/boards").json()[0]["id"]
    second_board = client.post("/api/boards", json={"name": "Second board"}).json()
    second_board_id = second_board["id"]

    first_backlog = next(
        c["id"]
        for c in client.get(f"/api/boards/{first_board_id}").json()["columns"]
        if c["title"] == "Backlog"
    )
    client.post(
        f"/api/boards/{first_board_id}/cards",
        json={"column_id": first_backlog, "title": "Only on board one", "details": ""},
    )

    second_board_state = client.get(f"/api/boards/{second_board_id}").json()
    assert second_board_state["cards"] == {}


def test_creating_a_board_requires_auth():
    client = TestClient(app)
    response = client.post("/api/boards", json={"name": "Nope"})
    assert response.status_code == 401
