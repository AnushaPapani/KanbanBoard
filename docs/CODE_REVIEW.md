# Code review

Full-codebase review (backend/ and frontend/), 2026-09-22. Findings are ranked most-severe first. All seven were fixed the same day; each section below has a **Fixed:** note.

## 1. AI chat actions can partially apply, then fail, with no rollback

**File:** `backend/app/main.py:198` (`/api/chat`), `backend/app/board.py`

`apply_action` is called once per action in a loop, each committing its own SQLite transaction immediately. If action 2 of 3 raises (e.g. it references a card the model hallucinated or that a stale board snapshot no longer matches), action 1 has already been permanently committed, but the request still errors out and the frontend shows a generic "Something went wrong" — the user has no idea the board was actually changed.

**Fix:** wrap the actions loop in a single SQLite transaction (or apply all actions to an in-memory copy of the board, validate, then commit once) so a failed chat turn either fully applies or fully no-ops.

**Fixed:** `board.py`'s mutation functions no longer commit internally; `/api/chat` now commits once after the whole actions loop succeeds, and rolls back on any `HTTPException`. Regression test: `test_chat_rolls_back_the_whole_batch_if_one_action_fails` (mocks `ai.chat` to force a mid-batch failure and asserts the earlier action was not persisted).

## 2. Chat actions from the model aren't validated before use

**File:** `backend/app/board.py:97` (`apply_action`)

`apply_action` indexes the dict Claude's tool call returns directly (`action["column_id"]`, `action["details"]`, etc.) with no schema check. The tool's `input_schema.required` list is a hint to the model, not something Anthropic enforces server-side — a malformed action (missing key, wrong type) raises an unhandled `KeyError`, surfacing as a raw 500 instead of a clean 400. Compounds finding #1 if it's not the first action in a batch.

**Fix:** validate each action against a Pydantic model (or at minimum `action.get(...)` with an explicit error) before dispatching, and return a 400 with a clear message rather than letting a `KeyError` propagate.

**Fixed:** added a Pydantic discriminated union (`AddCardAction` / `UpdateCardAction` / `DeleteCardAction` / `MoveCardAction` / `RenameColumnAction`) and `apply_action` now validates each action through it, raising a clean `HTTPException(400)` on a `ValidationError`. Regression test: `test_chat_rejects_malformed_action_and_leaves_board_unchanged`.

## 3. Frontend can get stuck on the loading screen forever

**File:** `frontend/src/app/page.tsx:14`

`getMe().then(...)` has no `.catch()`. `getMe()` only returns `null` for a 401; any other failure (backend 500, network error) makes it reject, the rejection is unhandled, `setStatus` is never called, and `Home()` keeps rendering `null` — a permanent blank page with no retry path until a manual reload, even after the backend recovers.

**Fix:** add a `.catch(() => setStatus("unauthenticated"))` (or a dedicated `"error"` status with a retry affordance, matching the pattern already used in `KanbanBoard.tsx`).

**Fixed:** added the `.catch()`. Regression test: `falls back to the login form if checking the session fails outright` (mocks `fetch` to reject with a `TypeError`, asserts the login form still renders instead of staying blank).

## 4. `scripts/stop.sh` fails if the container isn't running

**File:** `scripts/stop.sh:3`

Unlike `start.sh`, which guards `docker rm -f pm-app` with `|| true`, `stop.sh` runs it bare under `set -euo pipefail`. Running `stop.sh` when `pm-app` was never started, or running it twice, prints a Docker error and exits before reaching "pm-app stopped".

**Fix:** add the same `|| true` guard (or `docker stop`/`docker rm` with `2>/dev/null || true`) used in `start.sh`.

**Fixed:** `stop.sh` now uses `docker rm -f pm-app >/dev/null 2>&1 || true`; `stop.ps1` uses `docker rm -f pm-app 2>$null`, matching the pattern `start.ps1` already used for the same command.

## 5. Start scripts print the wrong environment variable name

**File:** `scripts/start.sh:6`, `scripts/start.ps1`

The echoed instruction says to set `OPENROUTER_API_KEY`, left over from before the switch to the Claude API. The app actually reads `CLAUDE_API_KEY` (`.env.example`, `backend/app/ai.py`). A new user following the printed instruction sets the wrong variable and the AI chat feature fails at runtime.

**Fix:** update the echoed message in both scripts to say `CLAUDE_API_KEY`.

**Fixed:** both scripts now echo `CLAUDE_API_KEY`.

## 6. Chat history leaks across backend tests

**File:** `backend/tests/conftest.py:11`

The autouse fixture resets the DB and clears `sessions`, but not `app.main.chat_history`. Tests in `test_chat.py` run in the same process, so an earlier test's conversation history is still present in a later test even though that test gets a fresh, empty database — making the live-model chat tests order-dependent and potentially flaky (the model sees unexpected prior turns).

**Fix:** also `chat_history.clear()` in the fixture.

**Fixed:** `conftest.py`'s autouse fixture now imports and clears `chat_history` alongside `sessions`.

## 7. `parseJsonOrThrow` is duplicated

**File:** `frontend/src/lib/auth.ts:3`, `frontend/src/lib/api.ts:3`

Identical helper defined in both files instead of one shared implementation. Not a bug today, but a maintenance trap — a future fix to error-body handling is easy to apply to one copy and forget the other.

**Fix:** move it into one module (e.g. `api.ts`) and import it from `auth.ts`, or a small shared `http.ts`.

**Fixed:** `parseJsonOrThrow` is now exported from `api.ts` and imported into `auth.ts`; the duplicate definition was removed.
