# Expansion plan: multi-user, multi-board, UX overhaul

Started via an autonomous `/loop` (max 6 iterations). This supersedes the original MVP's stated limitations ("hardcoded single user," "1 board per user") — moving the app into the "database will support multiple users for future" state that `CLAUDE.md` already anticipated.

Each iteration: make real progress, test thoroughly (unit + integration, backend and frontend), update this doc's checklist, verify against the real Docker container before moving on.

## Iteration budget

1. Real multi-user accounts (signup + login against the DB, hashed passwords) — still 1 board per user
2. Multi-board schema + backend API (create/list/switch boards per user)
3. Frontend for multi-board (board switcher/creator UI) + signup UI wiring
4. UI/UX overhaul pass
5. Integration/e2e hardening, edge cases, bug fixes
6. Final polish, docs, wrap-up

## Iteration 1: Real multi-user accounts — done

- [x] `users` table gains `password_hash`; login/signup validated against the DB instead of hardcoded constants
- [x] `bcrypt` for password hashing (`backend/app/security.py`)
- [x] `POST /api/signup`: creates a user (409 if username taken), their board, seed columns, session cookie
- [x] `POST /api/login`: looks up user, verifies hash
- [x] Demo account (`user`/`password`) still seeded on first boot for continuity with existing docs/testing instructions — now via the same `db.create_user` path every signup uses
- [x] Frontend: `LoginForm` gains a sign-in/sign-up toggle
- [x] Backend + frontend tests updated/added; verified against the real container
- [x] `docs/DATABASE.md`, `docs/schema.json`, `CLAUDE.md` updated to reflect the schema/limitation change

**Real bug found and fixed along the way:** seeded column ids were fixed literal strings (`col-backlog`, etc.) shared across every board — safe only under the old "exactly one board, ever" assumption. The moment a second user signed up, `create_user` tried to insert a column with the same `columns.id` primary key and hit a `UNIQUE constraint failed`. Fixed by generating a random per-board id (`col-` + hex) instead; updated the backend tests that had hardcoded the old literal ids to look columns up by title instead. Caught immediately by the new signup tests, not by manual testing — a good example of why the tests were worth writing first.

**Verification:** 29/29 backend tests, 18/18 frontend unit tests, 10/10 e2e tests, plus real-container checks: demo login still works, a fresh signup works, a duplicate username is rejected (409), and two real users' boards are genuinely isolated (verified via curl, including that each gets distinct per-board column ids).

## Iterations 2+3: Multi-board, backend and frontend — done

Done together in one turn rather than split: the backend API change is breaking (every board route now needs a `board_id`), so shipping just the backend would have left the running app broken until whenever iteration 3 happened to run next.

**Backend:**
- [x] Schema: `boards.user_id` loses its `UNIQUE` constraint, gains a `name` column
- [x] `GET /api/boards`, `POST /api/boards`, and every board/card/column/chat route moved under `/api/boards/{board_id}/...`, guarded by a `require_board_id` dependency (404, not 403, for a board that doesn't exist or isn't the caller's — avoids leaking existence)
- [x] `board.py` mutation functions simplified: they now take `board_id` directly (already ownership-checked by the route layer) instead of resolving it from `user_id` themselves
- [x] `db.create_board` extracted from `db.create_user` so both signup and "create another board" share identical seeding logic
- [x] Backend tests: multiple boards for one user, cross-board card isolation, cross-user board ownership (404 for someone else's board id) — new `test_boards.py`, plus ownership tests added to `test_board.py`/`test_chat.py`

**Frontend:**
- [x] New `Workspace` component: owns the board list + active board id, renders the header (moved out of `KanbanBoard`) once, and mounts `<KanbanBoard key={activeBoardId} boardId={activeBoardId} />` — switching boards is a clean remount rather than ad hoc refetch logic inside `KanbanBoard`
- [x] New `BoardSwitcher` component: a `<select>` of the user's boards + an inline "+ New board" form
- [x] `KanbanBoard` and `ChatSidebar` now take a required `boardId` prop; every `api.ts` function threads it into the URL
- [x] Frontend tests: new `Workspace.test.tsx` (switch, create), all board-touching tests in `KanbanBoard.test.tsx`/`ChatSidebar.test.tsx` updated for the `boardId` argument; e2e: rewrote `mockBoardApi.ts` for the board-scoped routes, added `boards.spec.ts` (create + switch, switch back and confirm the original board's cards are still there)

**Two real things caught along the way:**
1. Playwright's `getByRole` does *substring* matching on a plain string `name` by default (unlike Testing Library, which matches exactly) — the mode-toggle button's `aria-label="Switch to sign in"` silently matched the same query as the submit button's "Sign in", causing a strict-mode violation. Fixed with `exact: true`. Worth remembering for any future button pair with overlapping text.
2. A screenshot taken immediately after clicking the sign-up tab appeared to show the wrong tab still highlighted — turned out to be the CSS `transition` still animating at capture time, not a state bug (confirmed via `aria-pressed` assertions, which were correct immediately). A reminder to verify state directly rather than trusting a screenshot taken mid-animation.

**Verification:** 37/37 backend tests, 21/21 frontend unit tests, 12/12 e2e tests, plus real-container checks (curl): created a second board, added a card to board 1, confirmed board 2 untouched, ran a real chat message scoped to board 2 (created a card there, board 1 unaffected), confirmed a different signed-up user gets 404 on someone else's board id. Real-browser screenshots confirm the switcher and per-board card isolation visually.

## Iteration 4: UI/UX overhaul — done

Method: populated the real board with several realistic cards via the API, screenshotted the actual running app at desktop and mobile widths, and fixed what the screenshots actually showed — rather than guessing at changes.

- [x] **Real bug found:** card titles were `line-clamp`'d to 2 lines, but on a narrow 5-column desktop layout even moderate titles ("Fix login redirect bug") wrapped to 3 lines and got cut off mid-word. Root cause was really the always-visible "Edit / Remove" buttons sitting beside the title in a flex row, eating into its width. Fixed by moving actions below the title/details (full card width for text) and removed the title's line-clamp entirely — only `details` still clamps (4 lines), since that's what the original overflow complaint was actually about.
- [x] **Real bug found:** the card-count label said "1 CARDS" instead of "1 CARD" — simple pluralization fix in `KanbanColumn.tsx`.
- [x] Card actions (Edit/Remove) now reveal on hover/focus instead of always showing — cleaner default card appearance, still keyboard-accessible via `group-focus-within`
- [x] Added a lightweight spinner (`Spinner.tsx`) in place of plain "Loading..." text, used in `Workspace` and `KanbanBoard`
- [x] Mobile responsiveness verified with a real screenshot at 390px width — columns stack full-width, header and board switcher remain usable, chat panel fills the viewport sensibly. No changes needed; it already worked.
- [x] Regression test added for the pluralization fix (`KanbanBoard.test.tsx`)

**Verification:** 22/22 frontend unit tests, 12/12 e2e tests, plus real-container checks: repopulated the board with the same realistic cards used in the "before" audit and confirmed via screenshot that titles now display in full and the count is grammatically correct; a dedicated Playwright check confirmed hover-reveal actually toggles the actions row's opacity (checking the wrapper element's opacity, not a descendant button's — opacity isn't inherited, so the first attempt at this check was itself a test bug, not an app bug).

## Iteration 5: Integration/e2e hardening — done

**Real gap found:** sessions are documented as in-memory, lost on backend restart — but nothing actually handled a 401 arising *mid-session* from a board/chat call. A user active when the backend restarted would just see a generic "could not load" or "something went wrong" error with no path back to login.

- [x] `ApiError` class added to `api.ts` (carries the HTTP status) so callers can distinguish a session-expiry 401 from any other failure
- [x] `SessionContext` (new `lib/SessionContext.tsx`): a `notifyUnauthorized()` callback provided by `Home`, consumed by `Workspace`, `KanbanBoard`, and `ChatSidebar` without prop-drilling through every layer. Defaults to a no-op so components can still be unit-tested in isolation without a provider.
- [x] Every board/chat catch block now checks `isSessionExpired(error)` first and routes back to the login screen instead of showing its local error state
- [x] `Workspace`'s board-creation flow now surfaces its own errors and *rethrows* on failure, so `BoardSwitcher`'s inline form stays open with the typed name intact (previously the caller silently swallowed the error and the form would close either way)
- [x] Checked for other double-submit/edge-case gaps (`NewCardForm`, `KanbanCard`'s save flow) — both already close their form synchronously on submit, so no fix needed there; confirmed by reasoning through the code rather than assumed

**A real bug in my own first attempt at this:** `vi.mock("@/lib/api")` auto-mocks the whole module, including the `ApiError` *class* — so `instanceof ApiError` inside `isSessionExpired` failed in tests, since the mocked class isn't the same reference constructed by the mock. Fixed by switching to a factory mock (`importOriginal` + spread) that keeps `ApiError` real and only mocks the functions, in all three affected test files.

**Verification:** 26/26 frontend unit tests (4 new, covering the 401 path in each of the three components), 12/12 e2e, 37/37 backend. Real end-to-end confirmation against the live container: logged in, restarted the container (`docker restart pm-app`, wiping in-memory sessions but not the DB), then — without reloading the page — tried to add a card. Confirmed it bounced back to the login screen instead of showing a broken error.

## Iteration 6: Wrap-up — done

- [x] `CLAUDE.md` reviewed for coherence: updated the Limitations section (no longer "in-progress" — multi-user and multi-board both shipped), removed the "Starting Point" section, which described the very first frontend-only demo and had been stale since Part 2 of the original build
- [x] `docs/DATABASE.md`, `docs/schema.json` re-checked against the final schema — accurate as of iteration 5, no further changes needed
- [x] This section: summary below

### What shipped (all 6 iterations)

- **Real multi-user accounts**: signup/login against the DB with bcrypt-hashed passwords, replacing the original hardcoded `user`/`password` check (the demo account is now just one seeded user among potentially many, going through the identical code path as everyone else)
- **Multi-board per user**: every board-scoped route lives under `/api/boards/{board_id}/...` with ownership enforcement (404 for a board that isn't yours); a `Workspace` component owns board selection and a `BoardSwitcher` lets a user create and switch between boards
- **UI/UX overhaul**, all fixes driven by screenshots of the real running app rather than guesswork: a collapsible chat assistant (was always-open, eating board space), fixed card text overflow (root cause: a flex child missing `min-w-0`), card titles no longer clamp on narrow desktop columns (root cause: always-visible action buttons eating the title's width — moved actions below the content and made them hover-reveal), fixed "1 CARDS" pluralization, added a loading spinner
- **Session-expiry hardening**: any 401 from a board/chat call now cleanly routes back to the login screen instead of showing a broken error — verified against a real backend restart, not just mocked

### Real bugs found and fixed along the way (not hypothetical — each one reproduced and verified)

1. Seeded column ids were fixed literal strings, safe only under "exactly one board ever" — broke the moment a second board existed (`UNIQUE constraint failed`)
2. AI chat actions applied one at a time with individual commits — a mid-batch failure could leave the board silently, partially mutated
3. Chat actions from the model weren't validated — a malformed action raised an unhandled `KeyError` (500) instead of a clean 400
4. Frontend auth check had no `.catch()` — a non-401 failure left a permanent blank loading screen
5. `scripts/stop.sh` failed if the container wasn't already running
6. Start scripts told users to set `OPENROUTER_API_KEY`, stale from before the Claude API switch
7. Card text overflowed its box on longer AI-generated details (missing `min-w-0` on a flex child)
8. Card titles over-truncated on narrow desktop columns once the overflow fix was in place
9. "1 CARDS" instead of "1 CARD"
10. No handling anywhere for a session dying mid-use (documented behavior, never actually handled)
11. (Test-only, but worth remembering) Playwright's `getByRole` substring-matches a plain string `name` by default, unlike Testing Library's exact match — caused two separate false failures across this project
12. (Test-only) `vi.mock`'s automocking replaces exported classes too, breaking `instanceof` checks against them in tests

### What's explicitly out of scope / left for later

- No board deletion or rename endpoint (create + list only, per the original iteration-2 scope)
- No password reset / account recovery flow
- No real-time sync between multiple tabs/sessions viewing the same board
- Persistent (DB-backed) sessions and chat history — both still in-memory, lost on backend restart (now at least handled gracefully client-side, per iteration 5)
- Case-sensitive usernames (a product decision, not a bug, left as SQLite's default behavior)
