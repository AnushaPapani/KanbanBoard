from unittest.mock import patch

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


def test_chat_rejects_malformed_action_and_leaves_board_unchanged():
    client = authenticated_client()
    before = client.get("/api/board").json()

    fake_result = {
        "reply": "ok",
        "actions": [{"type": "add_card", "column_id": "col-backlog"}],  # missing title/details
    }
    with patch("app.ai.chat", return_value=fake_result):
        response = client.post("/api/chat", json={"message": "irrelevant, ai.chat is mocked"})

    assert response.status_code == 400
    assert client.get("/api/board").json() == before


def test_chat_rolls_back_the_whole_batch_if_one_action_fails():
    client = authenticated_client()
    add_response = client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Existing card", "details": ""},
    )
    card_id = add_response.json()["columns"][0]["cardIds"][0]

    fake_result = {
        "reply": "ok",
        "actions": [
            {"type": "rename_column", "column_id": "col-backlog", "title": "Renamed"},
            {"type": "delete_card", "card_id": "card-does-not-exist"},
        ],
    }
    with patch("app.ai.chat", return_value=fake_result):
        response = client.post("/api/chat", json={"message": "irrelevant, ai.chat is mocked"})

    assert response.status_code == 404

    board = client.get("/api/board").json()
    assert board["columns"][0]["title"] == "Backlog"
    assert card_id in board["cards"]
