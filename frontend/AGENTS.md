# Frontend

Next.js 16 (App Router) + React 19 demo of the Kanban board described in the root AGENTS.md. This was built as a frontend-only demo before the backend/auth/AI work started, so all state below is in-memory only (no API calls, no persistence).

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4 (tokens defined as CSS variables in `src/app/globals.css`, matching the root AGENTS.md color scheme)
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag and drop
- Vitest + Testing Library for unit tests, Playwright for e2e
- `next.config.ts` sets `output: "export"` (static export to `frontend/out`, consumed by the FastAPI backend)

## Structure

- `src/app/layout.tsx` — root layout, loads Space Grotesk (display) and Manrope (body) fonts
- `src/app/page.tsx` — renders `<KanbanBoard />`, the only route
- `src/lib/kanban.ts` — `Card`/`Column`/`BoardData` types, `initialData` seed data, and pure helpers `moveCard` (drag/drop reordering across and within columns) and `createId`
- `src/components/KanbanBoard.tsx` — top-level client component; owns `board` state, wires up `DndContext`, and holds the rename/add/delete/move handlers
- `src/components/KanbanColumn.tsx` — one column: droppable container, editable title input, `SortableContext` of cards, `NewCardForm`
- `src/components/KanbanCard.tsx` — one draggable card (sortable), with a delete button
- `src/components/KanbanCardPreview.tsx` — the card's appearance inside `DragOverlay` while dragging
- `src/components/NewCardForm.tsx` — inline form to add a card to a column

## State model (current, in-memory only)

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. Columns are a fixed list of 5 (Backlog, Discovery, In Progress, Review, Done) referencing card ids; cards are a flat map. Column titles are editable; columns themselves are not added/removed/reordered. This shape is the natural starting point for the database schema in PLAN.md Part 5 — the backend should aim to serialize/deserialize the same structure rather than inventing a new one.

## Tests

- Unit: `src/lib/kanban.test.ts` (move logic), `src/components/KanbanBoard.test.tsx` (board interactions) — run with `npm run test:unit`
- E2E: `tests/kanban.spec.ts` (Playwright, drives the running dev/build server) — run with `npm run test:e2e`
- `npm run test:all` runs both

## Known gaps vs. the full product (root AGENTS.md)

- No auth/login screen — anyone hitting `/` sees the board directly
- No backend calls — board resets to `initialData` on reload
- No AI chat sidebar
- Card "edit" is limited to delete + add; there's no edit-in-place for an existing card's title/details yet
