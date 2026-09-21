# Project Management MVP

A single-board Kanban app with an AI chat sidebar. See `CLAUDE.md` for the full requirements and `docs/PLAN.md` for the build plan.

## Running

Requires Docker.

```
scripts/start.sh   # Mac/Linux
scripts/start.ps1  # Windows
```

This builds the image, copies `.env.example` to `.env` on first run (add your `OPENROUTER_API_KEY` there), and serves the app at http://localhost:8000.

```
scripts/stop.sh    # Mac/Linux
scripts/stop.ps1   # Windows
```

## Development

- `backend/` — FastAPI app, managed with `uv`
- `frontend/` — Next.js app, statically exported and served by the backend at `/`
