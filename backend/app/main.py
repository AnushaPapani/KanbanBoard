import secrets
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import ai, board, db
from app.constants import HARDCODED_PASSWORD, HARDCODED_USERNAME

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_BUILD_DIR = PROJECT_ROOT / "frontend" / "out"
FALLBACK_INDEX = Path(__file__).resolve().parent / "static" / "index.html"

SESSION_COOKIE = "session_token"

# In-memory session store: MVP has no persistent session table, sessions are
# lost on backend restart (acceptable for this stage; users just log in again).
sessions: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Project Management MVP Backend", lifespan=lifespan)


class Credentials(BaseModel):
    username: str
    password: str


class SessionInfo(BaseModel):
    username: str


class RenameColumnRequest(BaseModel):
    title: str


class NewCardRequest(BaseModel):
    column_id: str
    title: str
    details: str = ""


class UpdateCardRequest(BaseModel):
    title: str
    details: str


class MoveCardRequest(BaseModel):
    column_id: str
    position: int


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    board: board.BoardData


# In-memory chat history: MVP has no persistent history table, lost on
# backend restart (acceptable for this stage, consistent with sessions).
chat_history: dict[int, list[dict]] = {}


def get_db() -> Iterator[sqlite3.Connection]:
    conn = db.get_connection()
    try:
        yield conn
    finally:
        conn.close()


def require_user_id(request: Request, conn: sqlite3.Connection = Depends(get_db)) -> int:
    token = request.cookies.get(SESSION_COOKIE)
    username = sessions.get(token) if token else None
    if username is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return row["id"]


@app.get("/api/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "message": "hello from the api"}


@app.post("/api/login", response_model=SessionInfo)
async def login(credentials: Credentials, response: Response) -> SessionInfo:
    if credentials.username != HARDCODED_USERNAME or credentials.password != HARDCODED_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    sessions[token] = credentials.username
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
    return SessionInfo(username=credentials.username)


@app.post("/api/logout")
async def logout(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(SESSION_COOKIE)
    if token is not None:
        sessions.pop(token, None)
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}


@app.get("/api/me", response_model=SessionInfo)
async def me(request: Request) -> SessionInfo:
    token = request.cookies.get(SESSION_COOKIE)
    username = sessions.get(token) if token else None
    if username is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return SessionInfo(username=username)


@app.get("/api/board", response_model=board.BoardData)
async def get_board(
    conn: sqlite3.Connection = Depends(get_db), user_id: int = Depends(require_user_id)
) -> board.BoardData:
    return board.get_board(conn, user_id)


@app.patch("/api/board/columns/{column_id}", response_model=board.BoardData)
async def rename_column(
    column_id: str,
    body: RenameColumnRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardData:
    return board.rename_column(conn, user_id, column_id, body.title)


@app.post("/api/board/cards", response_model=board.BoardData)
async def add_card(
    body: NewCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardData:
    return board.add_card(conn, user_id, body.column_id, body.title, body.details)


@app.patch("/api/board/cards/{card_id}", response_model=board.BoardData)
async def update_card(
    card_id: str,
    body: UpdateCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardData:
    return board.update_card(conn, user_id, card_id, body.title, body.details)


@app.delete("/api/board/cards/{card_id}", response_model=board.BoardData)
async def delete_card(
    card_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardData:
    return board.delete_card(conn, user_id, card_id)


@app.post("/api/board/cards/{card_id}/move", response_model=board.BoardData)
async def move_card(
    card_id: str,
    body: MoveCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardData:
    return board.move_card(conn, user_id, card_id, body.column_id, body.position)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> ChatResponse:
    current_board = board.get_board(conn, user_id)
    history = chat_history.setdefault(user_id, [])

    result = ai.chat(current_board.model_dump_json(), history, body.message)
    reply = result["reply"]

    for action in result.get("actions", []):
        board.apply_action(conn, user_id, action)

    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": reply})

    return ChatResponse(reply=reply, board=board.get_board(conn, user_id))


if FRONTEND_BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_BUILD_DIR), html=True), name="frontend")
else:
    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(FALLBACK_INDEX)
