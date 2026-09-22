# Database

SQLite, one file (`backend/data/app.db`), created with its schema applied automatically if it doesn't exist. Schema definition: `docs/schema.json`.

## Why this shape

Four tables: `users`, `boards`, `columns`, `cards`. It mirrors the frontend's existing `BoardData` type (`frontend/src/lib/kanban.ts`) directly so the backend doesn't invent a different model that then needs translating:

- `Column.id` / `Card.id` (stable strings like `col-a1b2c3d4`, `card-1`) are the primary keys in `columns`/`cards`, not autoincrement integers — a `GET /api/board` can build the frontend's `BoardData` JSON with no id remapping.
- `Card` has no `column_id` field in the frontend type (membership is implied by which `Column.cardIds` array contains it) — the DB makes that relationship explicit with `cards.column_id`, which is simpler to query and update than an array of ids.
- `position` (on both `columns` and `cards`) replaces `Column.cardIds`'s array ordering: "which cards are in this column, in what order" becomes `SELECT ... WHERE column_id = ? ORDER BY position`, rather than maintaining a separate ordered id list that has to stay in sync.
- `boards.user_id` is a plain (non-unique) foreign key — a user can own any number of boards (`docs/EXPANSION_PLAN.md` iteration 2), each identified by its own `boards.id` and a user-chosen `name`.

## Users and auth

`users` now backs real multi-user auth (`docs/EXPANSION_PLAN.md` iteration 1): `POST /api/signup` creates a new row with a bcrypt-hashed `password_hash`, and `POST /api/login` verifies against it. This superseded the original MVP's hardcoded-credential design — `users` is no longer just future-proofing, it's load-bearing.

## Boot behavior

On startup, the backend opens `backend/data/app.db` (creating the file and directory if missing), runs `CREATE TABLE IF NOT EXISTS` for all four tables, and — only if `users` is empty — seeds one demo user (`user`/`password`, hashed) via `db.create_user`, the same function `POST /api/signup` calls for every other user. Both create one default board (`db.create_board`) named "My Board" with the five seed columns. This is idempotent: restarting an existing container with an existing `app.db` file is a no-op beyond that emptiness check.

Column ids are generated per board (`col-` + a random hex suffix) rather than reused as fixed literals — with every board (and every user can now have several) needing its own set, a fixed literal like `col-backlog` would collide across boards on the `columns.id` primary key.

## Fixed columns

Each board's columns are seeded once when the board is created and are expected to be renamed (per the product's "fixed columns that can be renamed" requirement) but not added, removed, or reordered — so the API surface only needs a rename endpoint for columns, not full CRUD.

## Multiple boards per user

Every board-scoped route now lives under `/api/boards/{board_id}/...` and is guarded by a `require_board_id` dependency that checks `boards.user_id` matches the signed-in user before doing anything else, returning 404 (not 403) for a board that doesn't exist or isn't theirs — this avoids leaking whether a given board id exists at all. `GET /api/boards` lists a user's boards; `POST /api/boards` creates a new one (with its own seed columns) via the same `db.create_board` used at signup.
