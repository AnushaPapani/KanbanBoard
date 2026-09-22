#!/usr/bin/env bash
set -euo pipefail

docker rm -f pm-app >/dev/null 2>&1 || true
echo "pm-app stopped"
