from fastapi.testclient import TestClient

from app.main import app


def authenticated_client() -> tuple[TestClient, int]:
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    board_id = client.get("/api/boards").json()[0]["id"]
    return client, board_id


def column_id(client: TestClient, board_id: int, title: str) -> str:
    board = client.get(f"/api/boards/{board_id}").json()
    return next(c["id"] for c in board["columns"] if c["title"] == title)


def add_card(client: TestClient, board_id: int, column_id_: str, title: str, details: str = "") -> str:
    response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": column_id_, "title": title, "details": details},
    )
    body = response.json()
    column = next(c for c in body["columns"] if c["id"] == column_id_)
    return column["cardIds"][-1]


def test_get_board_requires_auth():
    client = TestClient(app)
    response = client.get("/api/boards/1")
    assert response.status_code == 401


def test_get_board_returns_seeded_columns():
    client, board_id = authenticated_client()
    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    body = response.json()
    assert [c["title"] for c in body["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert body["cards"] == {}


def test_get_someone_elses_board_returns_404():
    client, board_id = authenticated_client()
    other_client = TestClient(app)
    other_client.post("/api/signup", json={"username": "someone_else", "password": "whatever1"})

    response = other_client.get(f"/api/boards/{board_id}")
    assert response.status_code == 404


def test_rename_column():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    response = client.patch(f"/api/boards/{board_id}/columns/{backlog_id}", json={"title": "Todo"})
    assert response.status_code == 200
    assert response.json()["columns"][0]["title"] == "Todo"


def test_rename_missing_column_returns_404():
    client, board_id = authenticated_client()
    response = client.patch(
        f"/api/boards/{board_id}/columns/col-missing", json={"title": "Todo"}
    )
    assert response.status_code == 404


def test_add_card():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": backlog_id, "title": "Task", "details": "Notes"},
    )
    assert response.status_code == 200
    body = response.json()
    backlog = next(c for c in body["columns"] if c["id"] == backlog_id)
    assert len(backlog["cardIds"]) == 1
    card_id = backlog["cardIds"][0]
    assert body["cards"][card_id] == {"id": card_id, "title": "Task", "details": "Notes"}


def test_add_card_to_missing_column_returns_404():
    client, board_id = authenticated_client()
    response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": "col-missing", "title": "Task", "details": ""},
    )
    assert response.status_code == 404


def test_update_card():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    card_id = add_card(client, board_id, backlog_id, "Task")

    response = client.patch(
        f"/api/boards/{board_id}/cards/{card_id}",
        json={"title": "Updated", "details": "New notes"},
    )
    assert response.status_code == 200
    assert response.json()["cards"][card_id] == {
        "id": card_id,
        "title": "Updated",
        "details": "New notes",
    }


def test_update_missing_card_returns_404():
    client, board_id = authenticated_client()
    response = client.patch(
        f"/api/boards/{board_id}/cards/card-missing", json={"title": "x", "details": "y"}
    )
    assert response.status_code == 404


def test_delete_card():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    card_id = add_card(client, board_id, backlog_id, "Task")

    response = client.delete(f"/api/boards/{board_id}/cards/{card_id}")
    assert response.status_code == 200
    body = response.json()
    assert card_id not in body["cards"]
    assert body["columns"][0]["cardIds"] == []


def test_delete_missing_card_returns_404():
    client, board_id = authenticated_client()
    response = client.delete(f"/api/boards/{board_id}/cards/card-missing")
    assert response.status_code == 404


def test_move_card_between_columns():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    review_id = column_id(client, board_id, "Review")
    card_id = add_card(client, board_id, backlog_id, "Task")

    response = client.post(
        f"/api/boards/{board_id}/cards/{card_id}/move",
        json={"column_id": review_id, "position": 0},
    )
    assert response.status_code == 200
    body = response.json()
    backlog = next(c for c in body["columns"] if c["id"] == backlog_id)
    review = next(c for c in body["columns"] if c["id"] == review_id)
    assert backlog["cardIds"] == []
    assert review["cardIds"] == [card_id]


def test_move_card_reorders_within_same_column():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    first_id = add_card(client, board_id, backlog_id, "First")
    second_id = add_card(client, board_id, backlog_id, "Second")

    response = client.post(
        f"/api/boards/{board_id}/cards/{second_id}/move",
        json={"column_id": backlog_id, "position": 0},
    )
    assert response.status_code == 200
    backlog = response.json()["columns"][0]
    assert backlog["cardIds"] == [second_id, first_id]


def test_move_card_to_missing_column_returns_404():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    card_id = add_card(client, board_id, backlog_id, "Task")

    response = client.post(
        f"/api/boards/{board_id}/cards/{card_id}/move",
        json={"column_id": "col-missing", "position": 0},
    )
    assert response.status_code == 404


def test_cannot_mutate_someone_elses_board():
    client, board_id = authenticated_client()
    other_client = TestClient(app)
    other_client.post("/api/signup", json={"username": "someone_else", "password": "whatever1"})

    response = other_client.patch(
        f"/api/boards/{board_id}/columns/col-missing", json={"title": "Hijacked"}
    )
    assert response.status_code == 404
