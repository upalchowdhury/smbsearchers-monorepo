#!/usr/bin/env bash
# bootstrap_e2e.sh — non-destructive end-to-end bootstrap (no scrape execution)
# ===========================================================================
# This script prepares DB, schema, seed sources, FTS, and imports existing CSV data.
# It does NOT run paid scraping jobs.
#
# Usage:
#   bash /Users/uc/Documents/smbsearchers/dealflow/scripts/bootstrap_e2e.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "========================================"
echo " DealFlow E2E Bootstrap (No Scrape Run)"
echo "========================================"

echo "[1/5] Starting local infra (Postgres + Redis)"
cd "$ROOT_DIR"
docker compose up postgres redis -d

echo "[2/5] Prisma client + schema setup"
npm run db:gen
npm run db:setup

echo "[3/5] Applying full-text search migration"
npm run db:fts

echo "[4/5] Importing existing scraped CSVs"
npm run data:import

echo "[5/5] Done. You can now run app/worker locally"
echo "    npm run dev"
echo "    npm run worker"
echo ""
echo "No scheduled paid scraping jobs were triggered by this script."
