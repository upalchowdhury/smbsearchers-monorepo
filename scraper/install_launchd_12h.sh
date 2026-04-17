#!/usr/bin/env bash
# install_launchd_12h.sh — one-time installer for 12-hour launchd scraper
# =======================================================================
# This script installs the 12-hour schedule but does NOT manually trigger it.
#
# Usage:
#   bash /Users/uc/Documents/smbsearchers/scraper/install_launchd_12h.sh

set -euo pipefail

PLIST_SRC="/Users/uc/Documents/smbsearchers/scraper/bi12_scrape.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.smbsearchers.bi12.plist"
LABEL="com.smbsearchers.bi12"

echo ""
echo "=========================================="
echo "  SMB Searchers — 12h launchd Installer"
echo "=========================================="

if [[ ! -f "$PLIST_SRC" ]]; then
  echo "  ❌ Missing: $PLIST_SRC"
  exit 1
fi

# Stop existing job if loaded
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
  echo "  ⏹  Unloading existing 12h job..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

mkdir -p "$HOME/Library/LaunchAgents"

echo "  📋 Installing plist to ~/Library/LaunchAgents/"
cp "$PLIST_SRC" "$PLIST_DST"
chmod 644 "$PLIST_DST"

echo "  ▶ Loading job into launchd"
launchctl load "$PLIST_DST"

echo ""
echo "  ✅ Installed. Schedule is now 00:00 and 12:00 local time."
echo "  (No immediate run was started.)"
echo ""
echo "  Useful commands:"
echo "    Check status  : launchctl list | grep smbsearchers"
echo "    Run now       : launchctl start $LABEL"
echo "    View logs     : tail -f /Users/uc/Documents/smbsearchers/scraper/logs/bi12.log"
echo "    View errors   : tail -f /Users/uc/Documents/smbsearchers/scraper/logs/bi12_err.log"
echo "    Uninstall     : launchctl unload \"$PLIST_DST\" && rm \"$PLIST_DST\""
echo ""
