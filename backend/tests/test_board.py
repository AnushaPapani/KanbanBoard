from fastapi.testclient import TestClient

from app.main import app


def authenticated_client() -> TestClient:
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client


def add_card(client: TestClient, column_id: str, title: str, details: str = "") -> str:
    response = client.post(
        "/api/board/cards", json={"column_id": column_id, "title": title, "details": details}
    )
    body = response.json()
    column = next(c for c in body["columns"] if c["id"] == column_id)
    return column["cardIds"][-1]


def test_get_board_requires_auth():
    client = TestClient(app)
    response = client.get("/api/board")
    assert response.status_code == 401


def test_get_board_returns_seeded_columns():
    client = authenticated_client()
    response = client.get("/api/board")
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


def test_rename_column():
    client = authenticated_client()
    response = client.patch("/api/board/columns/col-backlog", json={"title": "Todo"})
    assert response.status_code == 200
    assert response.json()["columns"][0]["title"] == "Todo"


def test_rename_missing_column_returns_404():
    client = authenticated_client()
    response = client.patch("/api/board/columns/col-missing", json={"title": "Todo"})
    assert response.status_code == 404


def test_add_card():
    client = authenticated_client()
    response = client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Task", "details": "Notes"},
    )
    assert response.status_code == 200
    body = response.json()
    backlog = next(c for c in body["columns"] if c["id"] == "col-backlog")
    assert len(backlog["cardIds"]) == 1
    card_id = backlog["cardIds"][0]
    assert body["cards"][card_id] == {"id": card_id, "title": "Task", "details": "Notes"}


def test_add_card_to_missing_column_returns_404():
    client = authenticated_client()
    response = client.post(
        "/api/board/cards",
        json={"column_id": "col-missing", "title": "Task", "details": ""},
    )
    assert response.status_code == 404


def test_update_card():
    client = authenticated_client()
    card_id = add_card(client, "col-backlog", "Task")

    response = client.patch(
        f"/api/board/cards/{card_id}", json={"title": "Updated", "details": "New notes"}
    )
    assert response.status_code == 200
    assert response.json()["cards"][card_id] == {
        "id": card_id,
        "title": "Updated",
        "details": "New notes",
    }


def test_update_missing_card_returns_404():
    client = authenticated_client()
    response = client.patch(
        "/api/board/cards/card-missing", json={"title": "x", "details": "y"}
    )
    assert response.status_code == 404


def test_delete_card():
    client = authenticated_client()
    card_id = add_card(client, "col-backlog", "Task")

    response = client.delete(f"/api/board/cards/{card_id}")
    assert response.status_code == 200
    body = response.json()
    assert card_id not in body["cards"]
    assert body["columns"][0]["cardIds"] == []


def test_delete_missing_card_returns_404():
    client = authenticated_client()
    response = client.delete("/api/board/cards/card-missing")
    assert response.status_code == 404


def test_move_card_between_columns():
    client = authenticated_client()
    card_id = add_card(client, "col-backlog", "Task")

    response = client.post(
        f"/api/board/cards/{card_id}/move", json={"column_id": "col-review", "position": 0}
    )
    assert response.status_code == 200
    body = response.json()
    backlog = next(c for c in body["columns"] if c["id"] == "col-backlog")
    review = next(c for c in body["columns"] if c["id"] == "col-review")
    assert backlog["cardIds"] == []
    assert review["cardIds"] == [card_id]


def test_move_card_reorders_within_same_column():
    client = authenticated_client()
    first_id = add_card(client, "col-backlog", "First")
    second_id = add_card(client, "col-backlog", "Second")

    response = client.post(
        f"/api/board/cards/{second_id}/move", json={"column_id": "col-backlog", "position": 0}
    )
    assert response.status_code == 200
    backlog = response.json()["columns"][0]
    assert backlog["cardIds"] == [second_id, first_id]


def test_move_card_to_missing_column_returns_404():
    client = authenticated_client()
    card_id = add_card(client, "col-backlog", "Task")

    response = client.post(
        f"/api/board/cards/{card_id}/move", json={"column_id": "col-missing", "position": 0}
    )
    assert response.status_code == 404
