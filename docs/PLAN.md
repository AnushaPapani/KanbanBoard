# Build plan

Each part is a checkpoint: implement, run the tests, confirm success criteria, then move to the next part. Do not start a part until the previous one's checkboxes and tests are green.

## Current state (as of this plan)

- `frontend/` is a complete, working, frontend-only Kanban demo (Next.js 16 App Router, React 19, Tailwind v4, `@dnd-kit`). Documented in `frontend/AGENTS.md`. It has no auth, no backend calls, no AI chat yet, and column titles/cards live only in React state.
- `frontend/next.config.ts` is already set to `output: "export"` for static export.
- `backend/` has a bare FastAPI skeleton (`backend/app/main.py`) with a `/api/health` route and static-file mounting of `frontend/out` when present, falling back to a placeholder HTML file. No Docker, no auth, no DB, no AI. Not yet committed.
- No `Dockerfile`, no `scripts/` content, no `.env`, no `docs/` other than this file exist yet.

## Part 1: Plan (this part)

- [x] Enrich `docs/PLAN.md` with checklists, tests, and success criteria per part
- [x] Write `frontend/AGENTS.md` describing the existing frontend
- [x] User reviews and approves this plan before Part 2 starts

## Part 2: Scaffolding

Goal: a Docker container that runs the FastAPI backend, serves a hello-world page, and answers one API call. Start/stop scripts for Mac/Linux/Windows.

- [x] Confirm/clean up `backend/app/main.py`: `/api/health` route, static mount of `frontend/out` with a fallback page when it doesn't exist yet (added the missing `backend/app/static/index.html` fallback file)
- [x] `backend/pyproject.toml` using `uv` (replaced the plain `requirements.txt`)
- [x] `Dockerfile` at project root: multi-stage — build the Next.js static export, then a Python image that installs deps with `uv` and runs `uvicorn`
- [x] Documented `docker build`/`docker run` pair via the start/stop scripts (skipped `docker-compose.yml` — a single container doesn't need it; a data volume will be added in Part 5/6 when the SQLite file exists)
- [x] `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux), `scripts/start.ps1`, `scripts/stop.ps1` (Windows) that build/run/stop the container
- [x] `.env.example` documenting `OPENROUTER_API_KEY`; confirmed real `.env` is gitignored

Tests / success criteria:
- [x] `scripts/start.sh` brings up the container; `curl localhost:8000/api/health` returns `{"status": "ok", ...}` — verified
- [x] `curl localhost:8000/` returns HTML — because the Dockerfile builds the frontend in the same multi-stage build, this already serves the real Kanban board rather than the hello-world fallback (see Part 3 note below)
- [x] `scripts/stop.sh` cleanly stops the container — verified
- [x] Root README (minimal) explains how to run start/stop scripts

## Part 3: Add in frontend

Goal: the real Kanban demo is statically built and served by FastAPI at `/`, with tests passing.

Note: the Part 2 Dockerfile already builds and serves the real frontend (confirmed by curling `/` from the running container), since the multi-stage build compiles `frontend/` before the backend image is assembled. What's left here is confirming the frontend's own test suite passes.

- [x] Docker build stage runs `npm run build` in `frontend/`, producing `frontend/out`
- [x] FastAPI serves `frontend/out` at `/` (already wired in `main.py`; verified with the real build, not just the fallback)
- [x] Frontend unit tests (`npm run test:unit`) and e2e tests (`npm run test:e2e`) pass — 6 unit tests, 3 e2e tests, all green. Fixed a port collision in `playwright.config.ts`/e2e config (moved from 3000 to 3100 — 3000 was occupied by an unrelated project's dev server on this machine)

Tests / success criteria:
- Hitting `/` in a browser (or via container) shows the actual Kanban board, not the fallback page
- `npm run test:all` passes locally
- Drag/drop, column rename, add/delete card still work as they do in the standalone frontend demo

## Part 4: Fake user sign-in

Goal: hitting `/` requires logging in with `user`/`password`; logged-in state persists across reloads; logout works.

- [x] Backend: `POST /api/login` validates hardcoded credentials, sets an `httpOnly` session cookie; `POST /api/logout` clears it; `GET /api/me` reports current session user (or 401) — in-memory session store (`backend/app/main.py`), acceptable for MVP (sessions reset on backend restart; persistent sessions aren't in scope until a real DB exists)
- [x] Frontend: `src/app/page.tsx` is now an auth gate — calls `GET /api/me` on load, shows `LoginForm` (`src/components/LoginForm.tsx`) when signed out, `KanbanBoard` when signed in; a "Log out" button in the board header calls `/api/logout` and returns to the login screen
- [x] Auth branching is client-side (`src/lib/auth.ts` wraps `/api/me`, `/api/login`, `/api/logout`), consistent with the static export

Tests / success criteria:
- [x] Backend unit tests (`backend/tests/test_auth.py`, 5 tests): wrong credentials rejected, correct credentials issue a session, `/api/me` reflects login/logout state — all passing
- [x] Frontend unit tests (`src/app/page.test.tsx`, 3 tests, mocked fetch) and e2e tests (`tests/auth.spec.ts`, 3 tests, mocked API routes): unauthenticated load shows login form; correct credentials reveal the board; wrong password shows an error; logout returns to the login form — all passing. Existing `tests/kanban.spec.ts` updated to mock an authenticated session so it still exercises drag/drop independent of login.
- [x] Manual: verified against the real running Docker container with `curl` and a cookie jar — `/api/me` is 401 before login, login sets a cookie and returns 200, reusing that cookie against `/api/me` returns 200 (simulates a page reload keeping you logged in), logout clears the session and `/api/me` returns to 401

## Part 5: Database modeling

Goal: a SQLite schema for users + one Kanban board per user, documented and approved before backend work depends on it.

- [x] Draft schema as JSON in `docs/schema.json`: `users` (id, username), `boards` (id, user_id), `columns` (id, board_id, title, position — fixed set per board), `cards` (id, column_id, title, details, position). No password column — see `docs/DATABASE.md` for why.
- [x] Document the approach in `docs/DATABASE.md`: why this shape, how it maps to the frontend's `BoardData` type in `frontend/src/lib/kanban.ts`, migration-on-boot behavior (create DB file + tables if missing, seed on first boot)
- [x] User signs off on the schema before Part 6 starts

Tests / success criteria: schema doc reviewed and approved by the user.

## Part 6: Backend API for the board

Goal: authenticated API routes to read and mutate the signed-in user's board; DB auto-created on first run.

- [x] `GET /api/board` returns the current user's board as JSON (matching the frontend's `BoardData` shape)
- [x] `PATCH /api/board/columns/{id}` rename a column
- [x] `POST /api/board/cards`, `PATCH /api/board/cards/{id}`, `DELETE /api/board/cards/{id}`, and `POST /api/board/cards/{id}/move` (column + position) — implemented in `backend/app/board.py` (data layer) and wired up in `backend/app/main.py`
- [x] All routes require a valid session (401 otherwise) via the `require_user_id` dependency, and operate only on that user's board (looked up by user_id, 404 if a column/card doesn't belong to it)
- [x] DB file created with schema applied automatically if it doesn't exist (`backend/app/db.py`, run from a FastAPI `lifespan` hook on startup); `scripts/start.sh`/`start.ps1` now mount `./data` as a volume so it survives container restarts

Tests / success criteria:
- [x] Backend unit tests (`backend/tests/test_board.py`, 13 tests, isolated per-test via a temp DB in `conftest.py`): happy path for every route, unauthenticated rejection, not-found cases for missing columns/cards — all passing (18/18 backend tests total)
- [x] Fixed a bug surfaced by the tests: FastAPI runs sync dependencies in a threadpool separate from the async route handler's thread, which tripped sqlite3's same-thread check — fixed with `check_same_thread=False` (each connection is still only ever used sequentially within one request)
- [x] Manual, against the real Docker container: logged in, fetched the seeded empty board, renamed a column, added a card, moved it to another column, restarted the container (`docker restart`) and confirmed the board data survived (sessions did not, as documented — expected), then deleted `data/app.db` entirely, restarted via `scripts/start.sh`, and confirmed a fresh seeded board (default column titles, no leftover card)

## Part 7: Wire frontend to backend

Goal: the Kanban board is genuinely persistent — no more in-memory-only state.

- [x] Replaced `initialData`-seeded local state in `KanbanBoard.tsx` with a fetch of `GET /api/board` on load (`src/lib/api.ts` added as the HTTP client; `initialData`/`createId` removed from `kanban.ts` since ids and seed data now come from the backend)
- [x] Every mutation (rename column on blur, add/edit/delete card, drag-to-move card) calls the matching backend route, then replaces local state with the server's authoritative response
- [x] Basic loading/error handling: a "Loading board..." state on first fetch, an "Could not load the board" state if it fails, and a dismissible error banner + auto-refetch if a mutation fails
- [x] Added card editing (title/details, inline form on `KanbanCard`) — the business requirements call for cards to be "edited," and the backend already had `PATCH /api/board/cards/{id}` from Part 6, so this closed a real gap rather than expanding scope

Tests / success criteria:
- [x] Frontend unit tests (`KanbanBoard.test.tsx`, `page.test.tsx`) mock `@/lib/api` / `fetch` for each interaction — all passing (10/10 unit tests)
- [x] Playwright e2e tests (`kanban.spec.ts`, `auth.spec.ts`) mock the board API at the network layer for speed/isolation — all passing (7/7), including a new "edits a card" test
- [x] Manual, against the real Docker container (not mocked): a throwaway Playwright script drove a real browser through login → add card → reload (persists) → rename column → reload (persists) → edit card → reload (persists) → delete card → reload (persists) — all through genuine HTTP calls to the live FastAPI/SQLite backend, then discarded (kept out of the permanent suite, which intentionally mocks the network for speed)
- [x] `npm run test:all` (unit + e2e) and the Part 6 backend test suite both pass

## Part 8: AI connectivity

Goal: backend can call the Claude API directly and get a real response.

- [x] Backend client wrapper (`backend/app/ai.py`) using the Anthropic Python SDK, reading `CLAUDE_API_KEY` from the environment, model `claude-sonnet-5`
- [x] A minimal test (`backend/tests/test_ai.py`) that asks "what is 2+2" and checks the response contains "4"

Tests / success criteria: the 2+2 test passes against the live Claude API (integration test, not mocked) — verified twice: once via `pytest` in the local venv (19/19 backend tests pass, `.env` sourced into the shell), and once by rebuilding the Docker image and running `ai.ask(...)` inside the actual running container (`docker exec`), confirming the `anthropic` dependency installs correctly via `uv` and `CLAUDE_API_KEY` reaches the process through `--env-file .env`. Both returned "4".

## Part 9: AI chat with structured board updates

Goal: the backend always gives the AI the current board JSON, the user's message, and conversation history, and gets back a structured response: a reply to the user and an optional board update.

- [x] `POST /api/chat` endpoint (`backend/app/main.py`): takes the user's message, maintains in-memory conversation history per user, sends board JSON + history + message to Claude
- [x] Use Claude's tool use (a forced tool call to a `respond` tool with a JSON schema, `backend/app/ai.py`) so the model returns `{ reply: string, actions: Action[] }` — `actions` is a list (zero or more) rather than a single nullable update, since the AI needs to create/edit/move *one or more* cards in a turn per the business requirement
- [x] Applying each action reuses the Part 6 mutation logic exactly (`board.apply_action` dispatches to the same `add_card`/`update_card`/`delete_card`/`move_card`/`rename_column` functions the REST routes call) rather than a separate write path
- [x] Conversation history kept in-memory per user (`chat_history` dict in `main.py`), consistent with the sessions dict — lost on restart, acceptable for MVP

Tests / success criteria (`backend/tests/test_chat.py`, all against the live Claude API, not mocked):
- [x] A prompt that shouldn't change anything ("just say hello") returns an unchanged board — passed
- [x] A prompt to create a card ("Create a card called 'Write release notes'...") results in that card actually existing in the right column — passed
- [x] A prompt to move an existing card by title ("move the card titled 'Ship MVP' to Done") results in it actually being in `col-done` — passed
- [x] Full backend suite: 22/22 passing
- [x] Manual, against the real Docker container: created a card via chat, then in a **second** message said "move that card to Done" with no id/title repeated — the model correctly resolved "that card" from conversation history and moved it, confirming history actually round-trips through the API correctly

## Part 10: AI chat sidebar UI

Goal: a chat sidebar in the UI, fully wired to Part 9, with the board auto-refreshing when the AI changes it.

- [x] Sidebar component (`src/components/ChatSidebar.tsx`): message list + input, styled per the root CLAUDE.md color scheme; rendered alongside the board in `KanbanBoard.tsx` (flex row on desktop, stacks on mobile)
- [x] Sends messages to `POST /api/chat` (`api.sendChatMessage` in `src/lib/api.ts`), displays the reply in the message list
- [x] The response's `board` is applied directly via `setBoard` (passed down as `onBoardUpdate`) — no refetch needed since the chat endpoint already returns the full updated board, no full page reload

Tests / success criteria:
- [x] Frontend unit tests (`ChatSidebar.test.tsx`, 2 tests, mocked `@/lib/api`): sending a message shows the reply and reports the updated board; a failed request shows an error and leaves the board untouched
- [x] Playwright e2e test (`kanban.spec.ts`, network-mocked): sending a chat message that requests a card move updates the visible board — passed, along with the full suite (8/8)
- [x] Manual end-to-end walkthrough against the real Docker container and the live Claude API (throwaway Playwright script, discarded after): logged in, used chat to create a card ("Create a card called 'Chat smoke test' in the Backlog column..."), saw it appear in Backlog with no reload, then in a **second** message said "Now move the 'Chat smoke test' card to Done" (referencing it by name only, relying on conversation history) — saw it move to Done live. Confirms the whole feature works end to end, not just against mocks.
