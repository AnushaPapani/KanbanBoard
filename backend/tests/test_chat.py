from fastapi.testclient import TestClient

from app.main import app


def authenticated_client() -> TestClient:
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client


def test_chat_reply_with_no_board_change():
    client = authenticated_client()
    before = client.get("/api/board").json()

    response = client.post(
        "/api/chat",
        json={"message": "Just say hello, don't change anything on the board."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == before


def test_chat_creates_a_card():
    client = authenticated_client()

    response = client.post(
        "/api/chat",
        json={
            "message": (
                "Create a card called 'Write release notes' in the Backlog column, "
                "with details 'Summarize this week's changes.'"
            )
        },
    )
    assert response.status_code == 200
    board = response.json()["board"]
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    titles = [board["cards"][card_id]["title"] for card_id in backlog["cardIds"]]
    assert "Write release notes" in titles


def test_chat_moves_a_card():
    client = authenticated_client()
    add_response = client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Ship MVP", "details": "Finish the build"},
    )
    card_id = add_response.json()["columns"][0]["cardIds"][0]

    response = client.post(
        "/api/chat",
        json={"message": "Please move the card titled 'Ship MVP' to the Done column."},
    )
    assert response.status_code == 200
    board = response.json()["board"]
    done = next(c for c in board["columns"] if c["id"] == "col-done")
    assert card_id in done["cardIds"]
