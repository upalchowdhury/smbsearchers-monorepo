# DealFlow — SMB Business Acquisition Listings Aggregator

A full-stack platform that aggregates business-for-sale listings from **BizBuySell, BizQuest, Acquire.com, TransWorld, and Quiet Light** into a single searchable, deduplicated feed.

## Quick Start (Local)

One-command bootstrap (no paid scraping execution):

```bash
bash /Users/uc/Documents/smbsearchers/dealflow/scripts/bootstrap_e2e.sh
```

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)

### 1. Start Infrastructure

```bash
cd /Users/uc/Documents/smbsearchers/dealflow

# Start PostgreSQL + Redis
docker compose up postgres redis -d

# Verify they're running
docker compose ps
```

### 2. Set Up Database

```bash
# Generate Prisma client
npm run db:gen

# Push schema + seed sources
npm run db:setup

# Add full-text search (optional but recommended)
npm run db:fts
```

### 3. Run the App

```bash
# App only (Next.js dev server)
npm run dev

# App + background worker (scraper scheduler)
npm run dev:full
```

Open [http://localhost:3000](http://localhost:3000)

### 3.5 Load Existing Scraped Data (CSV → PostgreSQL)

If you already have scraped CSVs in `../scraper/csvoutput`, import them with:

```bash
# Uses SCRAPED_CSV_DIR if set, else defaults to ../scraper/csvoutput
npm run data:import
```

This importer is idempotent and upserts by `(sourceId, sourceListingId)`.

### 4. Trigger Your First Scrape

```bash
# Test scrape 2 pages from BizBuySell (no DB write)
npm run scrape:test bizbuysell 2

# Or use the Admin UI
open http://localhost:3000/admin
```

---

## Project Structure

```
dealflow/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page
│   │   ├── (app)/
│   │   │   ├── search/page.tsx # Main search UI
│   │   │   └── admin/page.tsx  # Admin dashboard
│   │   └── api/
│   │       ├── listings/route.ts   # Search API
│   │       ├── admin/route.ts      # Stats API
│   │       └── scrape/route.ts     # Trigger scrape
│   ├── scrapers/               # Playwright + Cheerio scrapers
│   │   ├── base.ts             # Abstract base class
│   │   ├── bizbuysell.ts
│   │   ├── bizquest.ts
│   │   ├── acquire.ts
│   │   ├── transworld.ts
│   │   └── quietlight.ts
│   ├── pipeline/
│   │   ├── normalizer.ts       # Raw → normalized listings
│   │   └── deduplicator.ts     # Cross-source dedup engine
│   ├── jobs/
│   │   ├── scheduler.ts        # BullMQ cron schedules
│   │   ├── workers.ts          # Job processors
│   │   └── worker-entry.ts     # Worker entry point
│   ├── scripts/
│   │   ├── seed-sources.ts     # Seed DB with source configs
│   │   └── test-scrape.ts      # Test scraper without DB
│   └── lib/
│       └── db.ts               # Prisma singleton + serializers
├── prisma/
│   └── schema.prisma           # Full data model
├── migrations/
│   └── add_search_vector.sql   # PostgreSQL FTS + trigram indexes
├── docker-compose.yml          # Local dev infrastructure
├── Dockerfile                  # Multi-stage production image
├── railway.toml                # Railway deployment config
└── .env.local                  # Local environment (not committed)
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:full` | Start Next.js + background worker |
| `npm run worker` | Start background worker only |
| `npm run db:setup` | Push schema + seed sources |
| `npm run db:fts` | Apply full-text search migration |
| `npm run data:import` | Import existing scraped CSV data into PostgreSQL |
| `npm run db:studio` | Open Prisma Studio |
| `npm run seed` | Re-seed source configurations |
| `npm run scrape:test [source] [pages]` | Test scraper output |

---

## Deployment

### Railway (Recommended)

1. Push this repo to GitHub
2. Create a new Railway project
3. Add **PostgreSQL** and **Redis** plugins
4. Deploy from GitHub — Railway reads `railway.toml` automatically
5. Set env vars in Railway dashboard (see `.env.example`)
6. Run DB setup in Railway Shell: `npm run db:setup && npm run db:fts`

### GCP Cloud Run

```bash
# Build and push image
docker build -t gcr.io/YOUR_PROJECT/dealflow .
docker push gcr.io/YOUR_PROJECT/dealflow

# Deploy
gcloud run deploy dealflow \
  --image gcr.io/YOUR_PROJECT/dealflow \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=...,REDIS_URL=...
```

For the background worker on GCP, deploy a separate Cloud Run service with the command:
```
npx tsx src/jobs/worker-entry.ts
```

---

## Sources

| Source | Type | Update Frequency |
|--------|------|-----------------|
| BizBuySell | HTML (Cheerio) | Every 6 hours |
| BizQuest | HTML (Cheerio) | 4x daily |
| Acquire.com | React SPA (Playwright) | 2x daily |
| TransWorld | HTML (Cheerio) | 1x daily |
| Quiet Light | HTML (Cheerio) | 1x daily |

---

## Environment Variables

See `.env.example` for all required and optional variables.

### Redis Caching

`/api/deals` uses Redis when `REDIS_URL` is present. Cache TTL is controlled by:

```bash
DEALS_CACHE_TTL_SECONDS=300
```

Cache is invalidated after successful scrape and dedup worker runs.

### Cloud Portability (AWS/GCP)

To keep migration seamless:
- keep all runtime config in env vars (`DATABASE_URL`, `REDIS_URL`, `DEALS_CACHE_TTL_SECONDS`)
- avoid absolute local paths in deployed jobs
- run scraper as an independent worker process/container
- use managed Postgres + managed Redis (Cloud SQL/ElastiCache/MemoryStore)
