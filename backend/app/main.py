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
from app.security import verify_password

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


class NewBoardRequest(BaseModel):
    name: str


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


# In-memory chat history, keyed by (user_id, board_id): MVP has no
# persistent history table, lost on backend restart (acceptable for this
# stage, consistent with sessions).
chat_history: dict[tuple[int, int], list[dict]] = {}


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


def require_board_id(
    board_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> int:
    row = conn.execute(
        "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board_id


@app.get("/api/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "message": "hello from the api"}


def _start_session(response: Response, username: str) -> None:
    token = secrets.token_urlsafe(32)
    sessions[token] = username
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")


@app.post("/api/signup", response_model=SessionInfo)
async def signup(
    credentials: Credentials,
    response: Response,
    conn: sqlite3.Connection = Depends(get_db),
) -> SessionInfo:
    username = credentials.username.strip()
    if not username or not credentials.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    existing = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username is already taken")

    db.create_user(conn, username, credentials.password)
    conn.commit()

    _start_session(response, username)
    return SessionInfo(username=username)


@app.post("/api/login", response_model=SessionInfo)
async def login(
    credentials: Credentials,
    response: Response,
    conn: sqlite3.Connection = Depends(get_db),
) -> SessionInfo:
    row = conn.execute(
        "SELECT username, password_hash FROM users WHERE username = ?",
        (credentials.username,),
    ).fetchone()
    if row is None or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _start_session(response, row["username"])
    return SessionInfo(username=row["username"])


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


@app.get("/api/boards", response_model=list[board.BoardSummary])
async def list_boards(
    conn: sqlite3.Connection = Depends(get_db), user_id: int = Depends(require_user_id)
) -> list[board.BoardSummary]:
    return board.list_boards(conn, user_id)


@app.post("/api/boards", response_model=board.BoardSummary)
async def create_board(
    body: NewBoardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user_id: int = Depends(require_user_id),
) -> board.BoardSummary:
    name = body.name.strip() or "Untitled board"
    new_board_id = db.create_board(conn, user_id, name)
    conn.commit()
    return board.BoardSummary(id=new_board_id, name=name)


@app.get("/api/boards/{board_id}", response_model=board.BoardData)
async def get_board(
    conn: sqlite3.Connection = Depends(get_db), board_id: int = Depends(require_board_id)
) -> board.BoardData:
    return board.get_board(conn, board_id)


@app.patch("/api/boards/{board_id}/columns/{column_id}", response_model=board.BoardData)
async def rename_column(
    column_id: str,
    body: RenameColumnRequest,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
) -> board.BoardData:
    result = board.rename_column(conn, board_id, column_id, body.title)
    conn.commit()
    return result


@app.post("/api/boards/{board_id}/cards", response_model=board.BoardData)
async def add_card(
    body: NewCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
) -> board.BoardData:
    result = board.add_card(conn, board_id, body.column_id, body.title, body.details)
    conn.commit()
    return result


@app.patch("/api/boards/{board_id}/cards/{card_id}", response_model=board.BoardData)
async def update_card(
    card_id: str,
    body: UpdateCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
) -> board.BoardData:
    result = board.update_card(conn, board_id, card_id, body.title, body.details)
    conn.commit()
    return result


@app.delete("/api/boards/{board_id}/cards/{card_id}", response_model=board.BoardData)
async def delete_card(
    card_id: str,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
) -> board.BoardData:
    result = board.delete_card(conn, board_id, card_id)
    conn.commit()
    return result


@app.post("/api/boards/{board_id}/cards/{card_id}/move", response_model=board.BoardData)
async def move_card(
    card_id: str,
    body: MoveCardRequest,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
) -> board.BoardData:
    result = board.move_card(conn, board_id, card_id, body.column_id, body.position)
    conn.commit()
    return result


@app.post("/api/boards/{board_id}/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    conn: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(require_board_id),
    user_id: int = Depends(require_user_id),
) -> ChatResponse:
    current_board = board.get_board(conn, board_id)
    history = chat_history.setdefault((user_id, board_id), [])

    result = ai.chat(current_board.model_dump_json(), history, body.message)
    reply = result["reply"]

    try:
        for action in result.get("actions", []):
            board.apply_action(conn, board_id, action)
    except HTTPException:
        conn.rollback()
        raise
    conn.commit()

    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": reply})

    return ChatResponse(reply=reply, board=board.get_board(conn, board_id))


if FRONTEND_BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_BUILD_DIR), html=True), name="frontend")
else:
    @app.get("/")
    async def root() -> FileResponse:
        return FileResponse(FALLBACK_INDEX)
