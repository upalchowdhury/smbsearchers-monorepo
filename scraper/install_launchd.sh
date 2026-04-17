#!/usr/bin/env bash
# install_launchd.sh — One-time macOS launchd installer for nightly scraper
# =========================================================================
# Run this once to install the nightly cron-equivalent on macOS.
# After installation, the scraper will run automatically every night at 11pm.
#
# Usage:
#   bash /Users/uc/Documents/smbsearchers/scraper/install_launchd.sh

set -euo pipefail

PLIST_SRC="/Users/uc/Documents/smbsearchers/scraper/nightly_scrape.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.smbsearchers.nightly.plist"
LABEL="com.smbsearchers.nightly"

echo ""
echo "=========================================="
echo "  SMB Searchers — launchd Installer"
echo "=========================================="

# Stop existing job if loaded
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
    echo "  ⏹  Unloading existing job..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Copy plist to LaunchAgents
echo "  📋  Installing plist to ~/Library/LaunchAgents/"
cp "$PLIST_SRC" "$PLIST_DST"
chmod 644 "$PLIST_DST"

# Load the job
echo "  ▶  Loading job into launchd..."
launchctl load "$PLIST_DST"

echo ""
echo "  ✅  Installed! Job will run every night at 11:00 PM."
echo ""
echo "  Useful commands:"
echo "    Check status  : launchctl list | grep smbsearchers"
echo "    Run now       : launchctl start $LABEL"
echo "    View logs     : tail -f /Users/uc/Documents/smbsearchers/scraper/logs/nightly.log"
echo "    View errors   : tail -f /Users/uc/Documents/smbsearchers/scraper/logs/nightly_err.log"
echo "    Uninstall     : launchctl unload \"$PLIST_DST\" && rm \"$PLIST_DST\""
echo ""
