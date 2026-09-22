from unittest.mock import patch

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


def test_chat_reply_with_no_board_change():
    client, board_id = authenticated_client()
    before = client.get(f"/api/boards/{board_id}").json()

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={"message": "Just say hello, don't change anything on the board."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"]
    assert body["board"] == before


def test_chat_creates_a_card():
    client, board_id = authenticated_client()

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={
            "message": (
                "Create a card called 'Write release notes' in the Backlog column, "
                "with details 'Summarize this week's changes.'"
            )
        },
    )
    assert response.status_code == 200
    board = response.json()["board"]
    backlog = next(c for c in board["columns"] if c["title"] == "Backlog")
    titles = [board["cards"][card_id]["title"] for card_id in backlog["cardIds"]]
    assert "Write release notes" in titles


def test_chat_moves_a_card():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    add_response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": backlog_id, "title": "Ship MVP", "details": "Finish the build"},
    )
    card_id = add_response.json()["columns"][0]["cardIds"][0]

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={"message": "Please move the card titled 'Ship MVP' to the Done column."},
    )
    assert response.status_code == 200
    board = response.json()["board"]
    done = next(c for c in board["columns"] if c["title"] == "Done")
    assert card_id in done["cardIds"]


def test_chat_rejects_malformed_action_and_leaves_board_unchanged():
    client, board_id = authenticated_client()
    before = client.get(f"/api/boards/{board_id}").json()
    backlog_id = column_id(client, board_id, "Backlog")

    fake_result = {
        "reply": "ok",
        "actions": [{"type": "add_card", "column_id": backlog_id}],  # missing title/details
    }
    with patch("app.ai.chat", return_value=fake_result):
        response = client.post(
            f"/api/boards/{board_id}/chat", json={"message": "irrelevant, ai.chat is mocked"}
        )

    assert response.status_code == 400
    assert client.get(f"/api/boards/{board_id}").json() == before


def test_chat_rolls_back_the_whole_batch_if_one_action_fails():
    client, board_id = authenticated_client()
    backlog_id = column_id(client, board_id, "Backlog")
    add_response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": backlog_id, "title": "Existing card", "details": ""},
    )
    card_id = add_response.json()["columns"][0]["cardIds"][0]

    fake_result = {
        "reply": "ok",
        "actions": [
            {"type": "rename_column", "column_id": backlog_id, "title": "Renamed"},
            {"type": "delete_card", "card_id": "card-does-not-exist"},
        ],
    }
    with patch("app.ai.chat", return_value=fake_result):
        response = client.post(
            f"/api/boards/{board_id}/chat", json={"message": "irrelevant, ai.chat is mocked"}
        )

    assert response.status_code == 404

    board = client.get(f"/api/boards/{board_id}").json()
    assert board["columns"][0]["title"] == "Backlog"
    assert card_id in board["cards"]


def test_chat_requires_owning_the_board():
    client, board_id = authenticated_client()
    other_client = TestClient(app)
    other_client.post("/api/signup", json={"username": "someone_else", "password": "whatever1"})

    response = other_client.post(
        f"/api/boards/{board_id}/chat", json={"message": "hi"}
    )
    assert response.status_code == 404
