import secrets
import sqlite3
from pathlib import Path

from app.constants import DEMO_PASSWORD, DEMO_USERNAME
from app.security import hash_password

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "app.db"

# (title, position). Column ids are generated per board (see create_user) —
# they used to be these fixed strings, but that only worked when there was
# ever exactly one board in the whole database; with multiple users each
# getting their own board, reusing the same literal ids collides on the
# columns.id primary key.
SEED_COLUMNS = [
    ("Backlog", 0),
    ("Discovery", 1),
    ("In Progress", 2),
    ("Review", 3),
    ("Done", 4),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id),
    title TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL REFERENCES columns(id),
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    position INTEGER NOT NULL
);
"""


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False: FastAPI runs sync dependencies (get_db,
    # require_user_id) in a threadpool separate from the async route
    # handler's thread. Each connection is still only ever used
    # sequentially within a single request, never concurrently.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_board(conn: sqlite3.Connection, user_id: int, name: str) -> int:
    """Create a board (with seed columns) for user_id. Does not commit."""
    conn.execute("INSERT INTO boards (user_id, name) VALUES (?, ?)", (user_id, name))
    board_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.executemany(
        "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
        [
            (f"col-{secrets.token_hex(4)}", board_id, title, position)
            for title, position in SEED_COLUMNS
        ],
    )
    return board_id


def create_user(conn: sqlite3.Connection, username: str, password: str) -> int:
    """Create a user with one default board (+ seed columns). Does not commit."""
    conn.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, hash_password(password)),
    )
    user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    create_board(conn, user_id, "My Board")
    return user_id


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            create_user(conn, DEMO_USERNAME, DEMO_PASSWORD)
        conn.commit()
    finally:
        conn.close()
