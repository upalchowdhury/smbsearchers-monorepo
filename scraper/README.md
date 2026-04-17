# DealFlow Scraper

Python three-tier scraper for 6 SMB listing sites → PostgreSQL.

## Setup

```bash
cd /Users/uc/Documents/smbsearchers/scraper
python3 -m venv .venv
source .venv/bin/activate

pip install playwright beautifulsoup4 lxml httpx asyncpg pydantic-settings \
            rich click python-dotenv langchain-openai openai

python3 -m playwright install chromium
```

Copy the env template and fill in your keys:
```bash
cp .env.example .env
# Edit .env — add TINYFISH_API_KEY and optionally OPENAI_API_KEY
```

## Usage

```bash
# Activate venv first
source .venv/bin/activate

# Dry-run (no DB writes, prints 3 sample listings to console)
python run.py --source quietlight --pages 1 --dry-run
python run.py --source bizbuysell --pages 2 --dry-run

# Run a single source (writes to DB)
python run.py --source quietlight --pages 5
python run.py --source bizbuysell --pages 10

# Run all 6 sources
python run.py --source all --pages 20

# Force a specific extraction tier
python run.py --source flippa --tier tier3   # Force TinyFish for Flippa
python run.py --source bizbuysell --tier tier2  # Force LLM extraction

# Debug logging
python run.py --source acquire --pages 1 --dry-run --log-level DEBUG
```

## Sources

| Source | URL | Tier 1 Strategy | Notes |
|--------|-----|----------------|-------|
| `bizbuysell` | bizbuysell.com | dt/dd fact sheet | 500K+ listings |
| `bizquest` | bizquest.com | dt/dd fact sheet | Large inventory |
| `acquire` | acquire.com | `__NEXT_DATA__` JSON | SaaS/tech focus |
| `transworld` | tworld.com | dt/dd + networkidle | Franchise-heavy |
| `quietlight` | quietlight.com | h3 title, `.inform_price` | ~150-200 digital listings |
| `flippa` | flippa.com | **TinyFish stealth primary** | Cloudflare protected |

## Architecture

```
run.py (CLI)
  └─ adapters/{site}.py    ← discover_urls() + scrape_listing()
       └─ tiers/tier_executor.py  ← Tier 1 → Tier 2 → Tier 3
            ├─ tiers/tier1_playwright.py    ← BS4 CSS/XPath selectors
            ├─ tiers/tier2_browser_use.py   ← GPT-4o-mini LLM extraction
            └─ tiers/tier3_tinyfish.py      ← TinyFish SSE cloud browser
       └─ core/db.py        ← asyncpg → Postgres (Prisma schema)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `TINYFISH_API_KEY` | For Flippa | Cloud anti-bot browser |
| `OPENAI_API_KEY` | Optional | Tier 2 LLM extraction fallback |

The scraper reads `DATABASE_URL` from `.env` (scraper dir) OR from `../dealflow/.env.local` automatically.

## Deployment Notes

To deploy alongside the Next.js app on Railway/GCP, add the scraper as a worker process that runs on a schedule:

```bash
# Run full scrape every 6 hours
python run.py --source all --pages 30
```

The scraper writes to the same PostgreSQL instance as the Next.js app — listings appear in the admin dashboard immediately after each source completes.

## 12-Hour Job Setup (macOS launchd)

The repo includes a 12-hour schedule configuration that runs at **00:00** and **12:00** local time.

Files:
- `/Users/uc/Documents/smbsearchers/scraper/bi12_scrape.sh`
- `/Users/uc/Documents/smbsearchers/scraper/bi12_scrape.plist`
- `/Users/uc/Documents/smbsearchers/scraper/install_launchd_12h.sh`

Install schedule (does **not** force an immediate scrape run):

```bash
bash /Users/uc/Documents/smbsearchers/scraper/install_launchd_12h.sh
```

Optional manual trigger later:

```bash
launchctl start com.smbsearchers.bi12
```

Logs:

```bash
tail -f /Users/uc/Documents/smbsearchers/scraper/logs/bi12.log
tail -f /Users/uc/Documents/smbsearchers/scraper/logs/bi12_err.log
```
