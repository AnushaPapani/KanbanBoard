import pytest

from app import db
from app.main import chat_history, sessions


@pytest.fixture(autouse=True)
def isolated_backend_state(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    sessions.clear()
    chat_history.clear()
    yield
