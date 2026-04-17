#!/usr/bin/env bash
# nightly_scrape.sh — macOS launchd / cron wrapper
# ================================================
# Runs the nightly delta scraper from the correct directory.
# The script activates the project venv and runs run_nightly.py.
#
# To install as a daily cron (11pm every night):
#   crontab -e
#   0 23 * * * /Users/uc/Documents/smbsearchers/scraper/nightly_scrape.sh >> /Users/uc/Documents/smbsearchers/scraper/logs/nightly.log 2>&1
#
# Or with macOS launchd — see nightly_scrape.plist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/python"
RUNNER="$SCRIPT_DIR/csvoutput/run_nightly.py"
LOG_DIR="$SCRIPT_DIR/logs"
TODAY=$(date +%Y-%m-%d)

mkdir -p "$LOG_DIR"

echo ""
echo "========================================"
echo "  SMB Scraper Nightly Run — $TODAY"
echo "========================================"
echo "Started: $(date)"
echo ""

cd "$SCRIPT_DIR"
"$VENV" "$RUNNER" "$@"

echo ""
echo "Finished: $(date)"
echo "========================================"
