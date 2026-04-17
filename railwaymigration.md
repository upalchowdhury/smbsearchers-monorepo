# DealFlow — Railway Deployment Guide

This guide walks you through deploying the DealFlow stack (Next.js web app + BullMQ worker + Python Playwright scraper + PostgreSQL + Redis) to Railway from scratch. Follow it top to bottom.

> **Prerequisites**
> - A GitHub repo containing your DealFlow code (monorepo or separate repos both work)
> - A Railway account (sign up at [railway.com](https://railway.com))
> - A credit card (required as of March 2026 — no credit-only accounts)
> - Node.js 18+ locally if you want to use the Railway CLI

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Install the Railway CLI](#2-install-the-railway-cli)
3. [Create the Project](#3-create-the-project)
4. [Add PostgreSQL](#4-add-postgresql)
5. [Add Redis](#5-add-redis)
6. [Deploy the Next.js Web Service](#6-deploy-the-nextjs-web-service)
7. [Deploy the BullMQ Worker Service](#7-deploy-the-bullmq-worker-service)
8. [Deploy the Python Scraper Service](#8-deploy-the-python-scraper-service)
9. [Configure Environment Variables & Secrets](#9-configure-environment-variables--secrets)
10. [Run Database Migrations & FTS Setup](#10-run-database-migrations--fts-setup)
11. [Set Up Scheduled Scraping (Cron)](#11-set-up-scheduled-scraping-cron)
12. [Configure Health Checks](#12-configure-health-checks)
13. [Add a Custom Domain](#13-add-a-custom-domain)
14. [Staging Environment](#14-staging-environment)
15. [Monitoring & Logging](#15-monitoring--logging)
16. [Scaling Strategy](#16-scaling-strategy)
17. [Cost Monitoring](#17-cost-monitoring)
18. [Troubleshooting](#18-troubleshooting)
19. [Deployment Checklist](#19-deployment-checklist)

---

## 1. Architecture Overview

On Railway, you'll end up with a single **project** containing five services:

```
DealFlow (Project)
├── web            ← Next.js app          (1 GB RAM recommended)
├── worker         ← BullMQ Node worker   (512 MB – 1 GB RAM)
├── scraper        ← Python + Playwright  (2 GB RAM — Chromium needs room)
├── Postgres       ← Managed database
└── Redis          ← Managed cache + queue
```

All five services share a **private network** scoped to the project, so `web` and `worker` talk to `Postgres` and `Redis` without going over the public internet (and without egress charges).

---

## 2. Install the Railway CLI

Optional but recommended. Lets you run commands with production env vars injected, tail logs, and manage variables from your terminal.

```bash
# macOS (Homebrew)
brew install railway

# npm (any OS)
npm i -g @railway/cli

# Verify install
railway --version

# Log in (opens browser)
railway login
```

---

## 3. Create the Project

### Via Dashboard (recommended for first time)

1. Go to [railway.com/new](https://railway.com/new)
2. Click **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub account if you haven't already
4. Select your DealFlow repo
5. **Important**: Don't let Railway auto-deploy yet — click the **Empty Project** option instead if offered, so we can set up databases first. If auto-deploy starts, that's fine, we'll configure it in step 6.

### Via CLI

```bash
cd /path/to/dealflow
railway init
# Follow the prompts: create new project, name it "dealflow"
railway link
```

After creation, you'll land on the Railway **Project Canvas** — the visual dashboard where services appear as boxes you can connect.

---

## 4. Add PostgreSQL

1. In the Project Canvas, click **+ Create** → **Database** → **Add PostgreSQL**
2. Railway provisions a Postgres instance and auto-creates these variables on the Postgres service:
   - `DATABASE_URL`
   - `DATABASE_PUBLIC_URL`
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
3. Verify: click the Postgres service → **Data** tab. You should see an empty database you can query.

> ⚠️ **Private networking**: Always use `DATABASE_URL` (internal) in your app services, **never** `DATABASE_PUBLIC_URL`. The public URL incurs egress charges; the internal one doesn't.

---

## 5. Add Redis

1. In the Project Canvas, click **+ Create** → **Database** → **Add Redis**
2. Railway provisions Redis and creates these variables on the Redis service:
   - `REDIS_URL`
   - `REDIS_PUBLIC_URL`
   - `REDISHOST`, `REDISPORT`, `REDISPASSWORD`
3. Same rule as Postgres: use `REDIS_URL` (internal) in your apps.

> 💡 BullMQ requires Redis 6+. Railway's managed Redis is Redis 7, so you're fine.

---

## 6. Deploy the Next.js Web Service

### 6a. Create the service

1. Click **+ Create** → **GitHub Repo** → select your DealFlow repo
2. In this repo, set **Root Directory** to `/dealflow` for the web service
3. Rename the service to `web` (Settings → top of page)

### 6b. Build configuration

Railway should auto-detect Next.js. If you have a `Dockerfile` in the web app directory, it'll use that instead (preferred for production consistency).

**If using Dockerfile** (recommended): Settings → Build → **Builder**: Dockerfile

**If using buildpack**: Railway will run `npm run build` and `npm start` automatically.

### 6c. Start command

Settings → Deploy → **Start Command**: `npm start` (or whatever your Next.js start script is)

### 6d. Expose publicly

Settings → Networking → **Generate Domain**. You'll get a `*.up.railway.app` URL. Don't add a custom domain yet — wait until everything works.

### 6e. Port

Next.js defaults to port 3000. Railway auto-detects this, but if you get "application failed to respond" errors, set **PORT=3000** explicitly in the service's variables tab.

---

## 7. Deploy the BullMQ Worker Service

1. Click **+ Create** → **GitHub Repo** → select the same DealFlow repo
2. Settings → **Source** → **Root Directory** → `/dealflow`
3. Rename service to `worker`
4. Settings → Deploy → **Start Command**: `node dist/worker.js` (or your worker entrypoint)
5. Networking → **Do NOT generate a domain**. Workers don't receive HTTP traffic.
6. Settings → Resources → Set **Memory Limit** to `1024 MB` to start (increase if you see OOM errors in logs)

> 💡 **Don't duplicate code**: Both `web` and `worker` pull from the same repo. Use a monorepo structure or adjust root directories accordingly. The same commit deploys both when you push.

---

## 8. Deploy the Python Scraper Service

This one needs extra care because Playwright + Chromium are memory-hungry and need specific system libraries.

### 8a. Create a Dockerfile for the scraper

In your scraper directory, create (or verify you have) a `Dockerfile` like this:

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Memory optimization for Chromium
ENV MALLOC_ARENA_MAX=2 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Run the scraper entrypoint (scheduler handles timing internally)
CMD ["python", "-m", "scraper.main"]
```

> 🧠 Using the official Microsoft Playwright Python image is the easiest way — it includes Chromium and all system libraries pre-installed. You don't need to install `libgbm`, `libnss3`, etc. manually.

### 8b. Create the Railway service

1. **+ Create** → **GitHub Repo** → same repo
2. Settings → **Source** → **Root Directory** → `/scraper`
3. Rename to `scraper`
4. Settings → Build → **Builder**: Dockerfile
5. Settings → Resources → **Memory Limit**: `2048 MB` (Playwright needs this minimum; 4 GB is safer if you scrape multiple sources in parallel)
6. Settings → Networking → **No public domain**

### 8c. If you prefer the scraper as an on-demand job

If your scraper only runs every 12 hours and shouldn't stay resident in memory between runs, see [Section 11](#11-set-up-scheduled-scraping-cron) — Railway's Cron trigger is a better fit than a long-running service. For now, continue as a service.

---

## 9. Configure Environment Variables & Secrets

This is where you apply the secrets strategy from earlier: reference variables for database URLs, sealed variables for true secrets, shared variables for things multiple services need.

### 9a. Create Shared Variables (project-wide secrets)

Go to **Project Settings** (top-right gear icon) → **Shared Variables** → select your environment (production) → add these. Check **Seal variable** for the sensitive ones.

| Variable | Seal? | Notes |
|---|---|---|
| `NEXTAUTH_SECRET` | ✅ Yes | NextAuth/session signing key. Generate with `openssl rand -base64 32` |
| `INTERNAL_API_SECRET` | ✅ Yes | For service-to-service auth between web & worker |
| `OPENAI_API_KEY` | ✅ Yes | Only if you're using Tier 2 LLM extraction |
| `TINYFISH_API_KEY` | ✅ Yes | For Tier 3 stealth scraping |
| `SMTP_PASSWORD` | ✅ Yes | Email alerts |
| `SMTP_HOST` | ❌ No | Not secret, just shared config |
| `SMTP_PORT` | ❌ No | |
| `SMTP_USER` | ❌ No | Email address, not secret |
| `NODE_ENV` | ❌ No | Set to `production` |
| `LOG_LEVEL` | ❌ No | e.g. `info` |

> ⚠️ **Sealed variables are one-way**. Once sealed, you can update the value but cannot unseal. If you accidentally seal the wrong variable, you'll need to delete and recreate it. Double-check before sealing.

### 9b. Share the shared variables with each service

Shared Variables exist at the project level, but services don't inherit them automatically. For each service:

1. Open service → **Variables** tab
2. Click **Shared Variable** → select the ones this service needs
3. Deploy when prompted

**Recommended sharing map**:
- `web`: `NEXTAUTH_SECRET`, `INTERNAL_API_SECRET`, `OPENAI_API_KEY`, `SMTP_*`, `NODE_ENV`, `LOG_LEVEL`
- `worker`: `INTERNAL_API_SECRET`, `OPENAI_API_KEY`, `SMTP_*`, `NODE_ENV`, `LOG_LEVEL`
- `scraper`: `OPENAI_API_KEY`, `TINYFISH_API_KEY`, `LOG_LEVEL`

### 9c. Add Reference Variables for DB/Redis

For each service that needs database or Redis access, go to the service's **Variables** tab and add these as regular (non-sealed) variables using Railway's reference syntax:

**On `web` service:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NEXTAUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

**On `worker` service:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

**On `scraper` service:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

> 💡 **Why not seal these?** The pattern `${{Postgres.DATABASE_URL}}` is a reference that resolves at deploy time. The actual credentials live on the Postgres service and aren't visible in your app's variable panel. Some users have reported bugs when sealing variables that use references — keep references unsealed and rely on the Postgres service's own isolation.

### 9d. Add service-specific variables

For any variables only one service uses (e.g., `SCRAPE_CONCURRENCY=3` on the scraper), add them directly on that service's Variables tab.

---

## 10. Run Database Migrations & FTS Setup

Your scope doc mentions a `db:setup` script and FTS SQL for the `tsvector` + GIN + trigram indexes. You have two ways to run these.

### Option A: Use Railway's one-shot command (simplest)

From your local machine, with the Railway CLI:

```bash
# Link to the web service (or whichever has your migration scripts)
railway link

# Run migrations with production env vars injected
railway run npm run db:migrate

# Run FTS setup
railway run npm run db:fts
```

This connects to the production Postgres from your laptop using the service's env vars, then runs the command.

### Option B: Release command (recommended for CI/CD)

Set a **predeploy command** on your `web` service so migrations run automatically on every deploy:

1. Web service → Settings → Deploy → **Pre-deploy Command**: `npm run db:migrate`
2. Save and redeploy

> ⚠️ Don't run migrations on both `web` and `worker` — pick one (usually `web`) to avoid race conditions.

### Verify your indexes exist

```bash
railway connect Postgres
# Once in psql:
\d listings
# Look for the tsvector column and GIN index
\di
# Confirm GIN and trigram (gin_trgm_ops) indexes are present
\q
```

---

## 11. Set Up Scheduled Scraping (Cron)

You mentioned 12-hour scheduling. On Railway, pick one of these approaches:

### Option A: Keep your BullMQ repeat schedules (recommended)

Your worker layer already has BullMQ cron schedules built in. Since the `worker` service runs 24/7, those schedules just work. No Railway config needed.

### Option B: Use Railway Cron Triggers

If you'd rather not keep the scraper resident 24/7 (saves memory costs), use Railway's Cron feature:

1. Open the `scraper` service → Settings → **Service Type** → change to **Cron**
2. Set **Cron Schedule**: `0 */12 * * *` (every 12 hours at minute 0)
3. Set **Restart Policy**: Never
4. The service now runs on schedule, executes your scraper, then shuts down. You're billed only for execution time.

> 💰 Option B is **much cheaper** if your scrape only takes 15–30 minutes to complete. 2 × 30 min = 1 hr/day of compute vs. 24 hr/day for a resident service. For a 2 GB RAM service that's roughly $2/mo vs. $50/mo.

### Option C: Scheduled BullMQ jobs triggered from web

The `/api/scrape` endpoint mentioned in your scope can also be hit by an external cron service (GitHub Actions on a schedule, Upstash QStash, etc.). This works but adds an external dependency — not recommended unless you already use one.

---

## 12. Configure Health Checks

Railway automatically restarts services that crash, but for the web service you want an HTTP health check too.

1. Web service → Settings → Deploy → **Healthcheck Path**: `/api/health`
2. Create `/api/health` in your Next.js app if you don't have one:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
}
```

3. Healthcheck Timeout: `300` seconds (generous on first boot)

For the `worker` service, Railway's process-level restart policy is enough. BullMQ handles job retries internally.

---

## 13. Add a Custom Domain

Once everything's working on the `*.up.railway.app` URL:

1. Web service → Settings → Networking → **+ Custom Domain**
2. Enter your domain (e.g., `app.dealflow.com`)
3. Railway shows a CNAME target — copy it
4. In your DNS provider (Cloudflare, Namecheap, etc.), add a `CNAME` record pointing your domain to that target
5. Wait 5–60 minutes for DNS propagation and automatic SSL provisioning
6. **After the domain resolves**, update `NEXTAUTH_URL` on the web service to `https://app.dealflow.com`

---

## 14. Staging Environment

Before you have real users, you want a staging env that mirrors production.

1. Project → **Environments** dropdown (top bar) → **+ New Environment**
2. Name: `staging`
3. Choose **Duplicate from production**
4. Railway clones all services and non-sealed variables
5. **Re-enter all sealed variables** for staging (use test keys where possible — test Stripe key, test SMTP credentials)
6. Use a separate Postgres + Redis for staging (duplicate creates them automatically)

Now you can push to a `staging` branch and have Railway deploy it to the staging env only. Configure this per service: Settings → Source → **Branch**: `staging`.

---

## 15. Monitoring & Logging

### Built-in observability

- **Service logs**: Service → **Logs** tab. Retained for 7 days (Hobby) or 30 days (Pro).
- **Metrics**: Service → **Metrics** tab. CPU, memory, network in/out per service.
- **Build logs**: Available per deployment in the **Deployments** tab.

### External log sink (recommended for production)

Railway's built-in log retention is short. Ship logs to an external sink:

- **Axiom** — generous free tier, Railway integration available
- **Better Stack (Logtail)** — $0 free tier for 1 GB/mo
- **Datadog** — if you already use it

Set up via: Service → Settings → **Log Drain** → provide your sink's endpoint.

### Alerts

Railway doesn't have built-in alerting on Hobby. Options:
- **Better Stack Uptime** — free tier monitors your public URL and pings you on downtime
- **Healthchecks.io** — your worker can ping it; alerts if the ping stops

---

## 16. Scaling Strategy

When you onboard more users, here's the order to scale things:

### Scale vertically first (easier, cheaper at low scale)

1. **Postgres out of memory / slow queries** → Postgres service → Settings → Resources → bump memory from 512 MB → 1 GB → 2 GB
2. **Worker jobs backing up** → Worker service → bump CPU/RAM, or increase BullMQ concurrency
3. **Web service slow under load** → Web service → bump to 2 GB RAM

### Scale horizontally when vertical isn't enough

**Web service** supports horizontal scaling:
- Web service → Settings → **Replicas** → bump to 2 or 3
- Railway load-balances across them automatically
- Make sure your Next.js app is stateless (no in-memory sessions)

**Worker service** — scaling replicas is trickier with BullMQ. BullMQ handles multiple workers pulling from the same queue correctly, so you can run 2+ replicas. Just ensure your job handlers are idempotent.

**Scraper service** — don't run multiple scraper replicas hitting the same source at the same time (you'll get rate-limited or banned). Keep at 1 replica; parallelize within the scraper code itself.

### When to leave Railway

If your monthly bill exceeds **~$300/mo**, start comparing costs with:
- **Fly.io** for compute (cheaper raw VMs)
- **Neon** or **Supabase** for Postgres (generous free tiers, pay-as-you-go)
- **Upstash** for Redis (serverless Redis, pay per request)

Your Dockerfile-based setup makes this migration a weekend project, not a rewrite.

---

## 17. Cost Monitoring

### Set up budget alerts

1. Workspace Settings → **Usage** → **Set Spend Limit**
2. Enter a hard cap (e.g., `$100/month`)
3. Railway will email you at 50%, 75%, 90%, and pause services at 100% if you enable auto-pause

### Watch these cost drivers

- **Memory allocation** — you pay for allocated memory even when idle. Don't over-provision "just in case."
- **Egress** — internal traffic between services is free; external traffic is $0.05/GB. Use `${{Service.RAILWAY_PRIVATE_DOMAIN}}` for service-to-service calls.
- **Staging environments** — a staging env running 24/7 roughly doubles your bill. Enable **app sleeping** on the staging env (Settings → Deploy → Sleep after inactivity) to avoid this.
- **Volumes** — charged 24/7 even when services are stopped. Delete old volumes you don't need.

### Check your usage

Workspace → **Usage** tab → see a per-service breakdown of CPU, memory, network. Review weekly until you understand your baseline.

---

## 18. Troubleshooting

### "Application failed to respond"
- Check the service is listening on `0.0.0.0:$PORT`, not `localhost`. Railway injects `PORT`, your app must use it.
- Check the healthcheck path exists and returns 200.

### Playwright: "Executable doesn't exist"
- Verify your Dockerfile uses `mcr.microsoft.com/playwright/python:v1.47.0-jammy` (or the Node variant)
- If you installed Playwright manually, make sure `PLAYWRIGHT_BROWSERS_PATH` matches where browsers were installed
- Increase memory to at least 1 GB; OOM kills during browser launch look like "executable not found"

### Worker keeps dying with SIGKILL
- Almost always OOM. Check Metrics tab — if memory hits 100%, bump the memory limit.
- Common with Playwright: allocate 2 GB+ and set `MALLOC_ARENA_MAX=2` in env vars

### DATABASE_URL is undefined
- Make sure you're using `${{Postgres.DATABASE_URL}}` (reference) not pasting the raw URL
- If you sealed a variable that uses a reference, unseal isn't possible — delete and recreate as unsealed
- Confirm the variable is set on the right environment (production vs staging)

### BullMQ jobs not processing
- Verify both `web` (producer) and `worker` (consumer) connect to the same Redis via `${{Redis.REDIS_URL}}`
- Check worker logs — it should log "Worker started" on boot
- Redis connection requires Redis 6+; Railway provides Redis 7

### Deploy succeeded but site is 404
- Root Directory setting is wrong — verify it points to the folder containing `package.json` / `Dockerfile`
- Build logs show what Railway actually built — check them

### High egress bill
- Apps are talking to each other via public URLs. Switch to `${{Service.RAILWAY_PRIVATE_DOMAIN}}` references.

---

## 19. Deployment Checklist

Before going live with real users, confirm:

### Security
- [ ] All secrets are **sealed** (check each Variables tab — sealed vars show a lock icon)
- [ ] `.env` files are in `.gitignore` and not committed
- [ ] `NEXTAUTH_SECRET` is a cryptographically random 32+ byte value
- [ ] Internal service calls use `RAILWAY_PRIVATE_DOMAIN`, not public URLs
- [ ] Spend limit is set on the workspace

### Reliability
- [ ] Healthcheck path configured on `web`
- [ ] Restart policy is `Always` on all services
- [ ] Database has daily backups enabled (Postgres service → Settings → Backups)
- [ ] Pre-deploy migration command configured on `web`

### Performance
- [ ] `tsvector` column + GIN index verified on `listings` table
- [ ] Trigram index verified
- [ ] Memory limits set appropriately (web: 1 GB, worker: 1 GB, scraper: 2 GB)
- [ ] Staging env is separate from production

### Observability
- [ ] Log drain configured (Axiom, Better Stack, or Datadog)
- [ ] Uptime monitoring pointed at your custom domain
- [ ] You know how to view logs, metrics, and deploy history

### Operations
- [ ] Custom domain resolves and serves HTTPS
- [ ] `NEXTAUTH_URL` uses the custom domain
- [ ] A runbook exists for common issues (this file is a start)
- [ ] You can deploy from `main` and roll back via the Deployments tab

---

## Appendix: Useful Railway CLI Commands

```bash
# Link to a project (run in project root)
railway link

# Run a command with production env vars injected
railway run <command>

# Tail logs for the current service
railway logs

# Connect directly to the Postgres service
railway connect Postgres

# List all variables on the linked service
railway variables

# Set a variable via CLI (non-sealed only)
railway variables --set KEY=value

# Deploy from CLI (forces a new deploy)
railway up

# Switch environments
railway environment staging
```

---

## Appendix: Expected Cost Breakdown (Early Stage)

Approximate monthly cost for a low-traffic production setup:

| Service | Memory | Estimated cost |
|---|---|---|
| `web` (Next.js) | 1 GB, always on | ~$10 |
| `worker` (BullMQ) | 512 MB – 1 GB, always on | ~$5–10 |
| `scraper` as cron (Option B) | 2 GB, 1 hr/day | ~$2 |
| `scraper` as service (Option A) | 2 GB, always on | ~$20 |
| Postgres | 512 MB | ~$5–8 |
| Redis | 256 MB | ~$3–5 |
| **Total (with cron scraper)** | | **~$25–35/mo** |
| **Total (with resident scraper)** | | **~$45–55/mo** |

Hobby plan base fee: **$5/mo** (includes $5 resource credit).

As you onboard users, the biggest cost-scaling factors will be: Postgres memory (as your listings table grows), egress bandwidth (if you serve lots of API traffic externally), and worker CPU (if scraping volume grows).

---

**Last updated**: April 2026 — Railway features and pricing may change. Check [docs.railway.com](https://docs.railway.com) if something looks different from this guide.