Start/stop scripts that build and run the Docker container defined by the root `Dockerfile`.

- `start.sh` / `start.ps1` — build the image, copy `.env.example` to `.env` on first run if missing, run the container as `pm-app` on port 8000, mounting `./data` (project root) to `/app/backend/data` so the SQLite database survives container restarts
- `stop.sh` / `stop.ps1` — remove the running `pm-app` container

No Mac-specific script is needed beyond `start.sh`/`stop.sh` (bash works the same on Mac and Linux).