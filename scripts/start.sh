#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found; copying .env.example (add CLAUDE_API_KEY before using AI chat)."
  cp .env.example .env
fi

docker rm -f pm-app >/dev/null 2>&1 || true
docker build -t pm-app .
docker run -d --name pm-app -p 8000:8000 --env-file .env -v "$(pwd)/data:/app/backend/data" pm-app

echo "pm-app running at http://localhost:8000"
