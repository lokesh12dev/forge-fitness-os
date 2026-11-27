#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

echo "FORGE FITNESS — Live Git → GitHub → Vercel sync"
echo "Watching $SCRIPT_DIR. Stop this watcher with Ctrl+C."
exec node "$SCRIPT_DIR/tools/auto-sync.mjs"
