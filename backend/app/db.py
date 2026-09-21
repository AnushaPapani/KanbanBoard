import sqlite3
from pathlib import Path

from app.constants import HARDCODED_USERNAME

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "app.db"

SEED_COLUMNS = [
    ("col-backlog", "Backlog", 0),
    ("col-discovery", "Discovery", 1),
    ("col-progress", "In Progress", 2),
    ("col-review", "Review", 3),
    ("col-done", "Done", 4),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id)
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


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            conn.execute("INSERT INTO users (username) VALUES (?)", (HARDCODED_USERNAME,))
            user_id = conn.execute(
                "SELECT id FROM users WHERE username = ?", (HARDCODED_USERNAME,)
            ).fetchone()[0]
            conn.execute("INSERT INTO boards (user_id) VALUES (?)", (user_id,))
            board_id = conn.execute(
                "SELECT id FROM boards WHERE user_id = ?", (user_id,)
            ).fetchone()[0]
            conn.executemany(
                "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
                [(col_id, board_id, title, position) for col_id, title, position in SEED_COLUMNS],
            )
        conn.commit()
    finally:
        conn.close()
