#!/usr/bin/env bash
# bi12_scrape.sh — 12-hour scraper wrapper for macOS launchd/cron
# ===============================================================
# Runs the Python scraper every 12 hours (when scheduled by launchd/crontab).
# This script does NOT schedule anything by itself.
#
# Manual run (optional, not required now):
#   /Users/uc/Documents/smbsearchers/scraper/bi12_scrape.sh
#
# Optional args are passed through to run.py
# Example:
#   /Users/uc/Documents/smbsearchers/scraper/bi12_scrape.sh --source flippa --pages 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
RUNNER="$SCRIPT_DIR/run.py"
LOG_DIR="$SCRIPT_DIR/logs"
TODAY=$(date +%Y-%m-%d)
NOW=$(date +%Y-%m-%dT%H:%M:%S%z)

# Default scope (override with env vars if needed)
DEFAULT_SOURCE="${SCRAPE_SOURCE:-all}"
DEFAULT_PAGES="${SCRAPE_MAX_PAGES:-20}"
DEFAULT_LOG_LEVEL="${LOG_LEVEL:-INFO}"

mkdir -p "$LOG_DIR"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "[bi12] ERROR: Python venv not found at $PYTHON_BIN"
  echo "[bi12] Create it first: cd $SCRIPT_DIR && python3 -m venv .venv && source .venv/bin/activate"
  exit 1
fi

echo ""
echo "========================================"
echo "  SMB Scraper 12h Run — $TODAY"
echo "========================================"
echo "Started: $NOW"
echo ""

cd "$SCRIPT_DIR"

if [[ $# -gt 0 ]]; then
  "$PYTHON_BIN" "$RUNNER" "$@"
else
  "$PYTHON_BIN" "$RUNNER" --source "$DEFAULT_SOURCE" --pages "$DEFAULT_PAGES" --log-level "$DEFAULT_LOG_LEVEL"
fi

echo ""
echo "Finished: $(date +%Y-%m-%dT%H:%M:%S%z)"
echo "========================================"
