import secrets
import sqlite3
from typing import Annotated, Literal, Union

from fastapi import HTTPException
from pydantic import BaseModel, Field, TypeAdapter, ValidationError


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


def _get_board_id(conn: sqlite3.Connection, user_id: int) -> int:
    row = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return row["id"]


def _require_column(conn: sqlite3.Connection, board_id: int, column_id: str) -> None:
    row = conn.execute(
        "SELECT id FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Column not found")


def _require_card(conn: sqlite3.Connection, board_id: int, card_id: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT cards.id, cards.column_id, cards.title, cards.details
        FROM cards
        JOIN columns ON columns.id = cards.column_id
        WHERE cards.id = ? AND columns.board_id = ?
        """,
        (card_id, board_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return row


def _renumber_column(conn: sqlite3.Connection, column_id: str) -> None:
    rows = conn.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position", (column_id,)
    ).fetchall()
    for index, row in enumerate(rows):
        conn.execute("UPDATE cards SET position = ? WHERE id = ?", (index, row["id"]))


def get_board(conn: sqlite3.Connection, user_id: int) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    column_rows = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
    ).fetchall()

    columns = []
    cards: dict[str, Card] = {}
    for column_row in column_rows:
        card_rows = conn.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position",
            (column_row["id"],),
        ).fetchall()
        for card_row in card_rows:
            cards[card_row["id"]] = Card(**dict(card_row))
        columns.append(
            Column(
                id=column_row["id"],
                title=column_row["title"],
                cardIds=[card_row["id"] for card_row in card_rows],
            )
        )

    return BoardData(columns=columns, cards=cards)


def rename_column(conn: sqlite3.Connection, user_id: int, column_id: str, title: str) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    _require_column(conn, board_id, column_id)
    conn.execute("UPDATE columns SET title = ? WHERE id = ?", (title, column_id))
    return get_board(conn, user_id)


def add_card(
    conn: sqlite3.Connection, user_id: int, column_id: str, title: str, details: str
) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    _require_column(conn, board_id, column_id)
    position = conn.execute(
        "SELECT COUNT(*) FROM cards WHERE column_id = ?", (column_id,)
    ).fetchone()[0]
    card_id = f"card-{secrets.token_hex(6)}"
    conn.execute(
        "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
        (card_id, column_id, title, details, position),
    )
    return get_board(conn, user_id)


def update_card(
    conn: sqlite3.Connection, user_id: int, card_id: str, title: str, details: str
) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    _require_card(conn, board_id, card_id)
    conn.execute("UPDATE cards SET title = ?, details = ? WHERE id = ?", (title, details, card_id))
    return get_board(conn, user_id)


def delete_card(conn: sqlite3.Connection, user_id: int, card_id: str) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    card = _require_card(conn, board_id, card_id)
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    _renumber_column(conn, card["column_id"])
    return get_board(conn, user_id)


def move_card(
    conn: sqlite3.Connection, user_id: int, card_id: str, target_column_id: str, position: int
) -> BoardData:
    board_id = _get_board_id(conn, user_id)
    card = _require_card(conn, board_id, card_id)
    _require_column(conn, board_id, target_column_id)

    source_column_id = card["column_id"]
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    _renumber_column(conn, source_column_id)

    remaining = conn.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position", (target_column_id,)
    ).fetchall()
    clamped_position = max(0, min(position, len(remaining)))

    conn.execute(
        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
        (target_column_id, clamped_position),
    )
    conn.execute(
        "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
        (card_id, target_column_id, card["title"], card["details"], clamped_position),
    )
    return get_board(conn, user_id)


class AddCardAction(BaseModel):
    type: Literal["add_card"]
    column_id: str
    title: str
    details: str


class UpdateCardAction(BaseModel):
    type: Literal["update_card"]
    card_id: str
    title: str
    details: str


class DeleteCardAction(BaseModel):
    type: Literal["delete_card"]
    card_id: str


class MoveCardAction(BaseModel):
    type: Literal["move_card"]
    card_id: str
    column_id: str
    position: int


class RenameColumnAction(BaseModel):
    type: Literal["rename_column"]
    column_id: str
    title: str


ChatAction = Annotated[
    Union[AddCardAction, UpdateCardAction, DeleteCardAction, MoveCardAction, RenameColumnAction],
    Field(discriminator="type"),
]

_chat_action_adapter: TypeAdapter[ChatAction] = TypeAdapter(ChatAction)


def apply_action(conn: sqlite3.Connection, user_id: int, action: dict) -> None:
    try:
        parsed = _chat_action_adapter.validate_python(action)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid board action: {exc}") from exc

    if isinstance(parsed, AddCardAction):
        add_card(conn, user_id, parsed.column_id, parsed.title, parsed.details)
    elif isinstance(parsed, UpdateCardAction):
        update_card(conn, user_id, parsed.card_id, parsed.title, parsed.details)
    elif isinstance(parsed, DeleteCardAction):
        delete_card(conn, user_id, parsed.card_id)
    elif isinstance(parsed, MoveCardAction):
        move_card(conn, user_id, parsed.card_id, parsed.column_id, parsed.position)
    elif isinstance(parsed, RenameColumnAction):
        rename_column(conn, user_id, parsed.column_id, parsed.title)
