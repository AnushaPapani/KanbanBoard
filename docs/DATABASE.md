# Database

SQLite, one file (`backend/data/app.db`), created with its schema applied automatically if it doesn't exist. Schema definition: `docs/schema.json`.

## Why this shape

Four tables: `users`, `boards`, `columns`, `cards`. It mirrors the frontend's existing `BoardData` type (`frontend/src/lib/kanban.ts`) directly so the backend doesn't invent a different model that then needs translating:

- `Column.id` / `Card.id` (stable strings like `col-backlog`, `card-1`) are the primary keys in `columns`/`cards`, not autoincrement integers — a `GET /api/board` can build the frontend's `BoardData` JSON with no id remapping.
- `Card` has no `column_id` field in the frontend type (membership is implied by which `Column.cardIds` array contains it) — the DB makes that relationship explicit with `cards.column_id`, which is simpler to query and update than an array of ids.
- `position` (on both `columns` and `cards`) replaces `Column.cardIds`'s array ordering: "which cards are in this column, in what order" becomes `SELECT ... WHERE column_id = ? ORDER BY position`, rather than maintaining a separate ordered id list that has to stay in sync.
- `boards.user_id` is `UNIQUE`, which is what actually enforces "one board per user" for the MVP.

## Users and auth

`users` exists so the schema "supports multiple users for the future" per the project's stated limitation, but the MVP's login check (`backend/app/main.py`) stays hardcoded to `user`/`password` as already built in Part 4 — it does not query this table. Because of that, `users` intentionally has no password column: a column that isn't checked by anything would just be a stored plaintext password with no purpose, which is worse than not having it. When real per-user auth is added later, that's a schema migration at that time, not now.

## Boot behavior

On startup, the backend opens `backend/data/app.db` (creating the file and directory if missing), runs `CREATE TABLE IF NOT EXISTS` for all four tables, and — only if `users` is empty — inserts the seed data in `docs/schema.json`'s `seed_on_first_boot`: one user (`user`), their board, and the five fixed columns (Backlog, Discovery, In Progress, Review, Done) with no cards. This is idempotent: restarting an existing container with an existing `app.db` file is a no-op beyond that emptiness check.

## Fixed columns

The columns are seeded once and are expected to be renamed (per the product's "fixed columns that can be renamed" requirement) but not added, removed, or reordered — so Part 6's API surface only needs a rename endpoint for columns, not full CRUD.
