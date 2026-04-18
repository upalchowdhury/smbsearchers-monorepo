"""asyncpg database layer — writes NormalizedListing to Prisma-managed tables.

Schema notes (from prisma/schema.prisma):
- Source.name is @unique (no slug column) — we use name as the key
- ScrapeRun.status is enum: PENDING | RUNNING | COMPLETED | FAILED
- Listing.status is enum: ACTIVE | SOLD | UNDER_CONTRACT | DELISTED | EXPIRED
- All financial columns are BigInt (stored as cents)
- Source uses cuid() IDs (Prisma default)
"""
from __future__ import annotations
import asyncpg
import logging
from datetime import datetime, timezone
from typing import Optional

from .config import settings
from .models import NormalizedListing

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# Source names map (we use name as the unique key for Source)
_SOURCE_NAMES = {
    "bizbuysell": "BizBuySell",
    "bizquest": "BizQuest",
    "acquire": "Acquire.com",
    "transworld": "TransWorld Business Advisors",
    "quietlight": "Quiet Light Brokerage",
    "flippa": "Flippa",
}

_SOURCE_URLS = {
    "bizbuysell": "https://www.bizbuysell.com",
    "bizquest": "https://www.bizquest.com",
    "acquire": "https://acquire.com",
    "transworld": "https://www.tworld.com",
    "quietlight": "https://quietlight.com",
    "flippa": "https://flippa.com",
}


async def ensure_source(conn: asyncpg.Connection, slug: str) -> str:
    """Upsert a Source row and return its id (cuid)."""
    name = _SOURCE_NAMES.get(slug, slug.title())
    base_url = _SOURCE_URLS.get(slug, "")

    try:
        row = await conn.fetchrow("""
            INSERT INTO "Source" (id, name, "baseUrl", "isActive", "createdAt", "updatedAt")
            VALUES (
                'c' || replace(gen_random_uuid()::text, '-', ''),
                $1, $2, true, NOW(), NOW()
            )
            ON CONFLICT (name) DO UPDATE SET "updatedAt" = NOW()
            RETURNING id
        """, name, base_url)
    except asyncpg.exceptions.UndefinedTableError as e:
        raise RuntimeError(
            "Database schema not initialized: missing Prisma tables (e.g. \"Source\"). "
            "Run migrations on the SAME DATABASE_URL used by scraper: "
            "`npm run db:migrate:deploy` then `npm run db:fts` from the web service. "
            "Also verify scraper DATABASE_URL points to the same Postgres instance."
        ) from e
    return row["id"]


async def create_scrape_run(conn: asyncpg.Connection, source_id: str) -> str:
    """Insert a ScrapeRun record and return its id."""
    row = await conn.fetchrow("""
        INSERT INTO "ScrapeRun" (
            id, "sourceId", status, "startedAt", "createdAt"
        )
        VALUES (
            'c' || replace(gen_random_uuid()::text, '-', ''),
            $1, 'RUNNING', NOW(), NOW()
        )
        RETURNING id
    """, source_id)
    return row["id"]


async def finish_scrape_run(
    conn: asyncpg.Connection,
    run_id: str,
    *,
    found: int,
    new: int,
    updated: int,
    errors: int,
    status: str = "COMPLETED",
) -> None:
    await conn.execute("""
        UPDATE "ScrapeRun"
        SET status = $2::"ScrapeStatus",
            "listingsFound" = $3,
            "listingsNew" = $4,
            "listingsUpdated" = $5,
            "completedAt" = NOW()
        WHERE id = $1
    """, run_id, status, found, new, updated)


async def upsert_listing(
    conn: asyncpg.Connection,
    listing: NormalizedListing,
    source_id: str,
    run_id: str,
) -> str:
    """Upsert a listing. Returns 'new' or 'updated'."""
    # Check if listing exists
    existing = await conn.fetchrow("""
        SELECT id, "askingPrice" FROM "Listing"
        WHERE "sourceId" = $1 AND "sourceListingId" = $2
    """, source_id, listing.source_listing_id)

    is_new = existing is None

    if is_new:
        # Generate a cuid-like ID
        new_id = await conn.fetchval(
            "SELECT 'c' || replace(gen_random_uuid()::text, '-', '')"
        )
        await conn.execute("""
            INSERT INTO "Listing" (
                id, "sourceId", "sourceListingId", "sourceUrl",
                title, description,
                industry, "industryNormalized", "businessType",
                "askingPrice", "askingPriceRaw",
                revenue, "revenueRaw",
                "cashFlow", "cashFlowRaw", "cashFlowType",
                city, state, "stateCode", country,
                "brokerName", "brokerCompany", "brokerPhone", "brokerEmail",
                "sellerFinancing",
                "yearEstablished", employees,
                "isAbsenteeOwner", "isFranchise", "isHomeBased", "hasRealEstate",
                "reasonForSelling",
                status, "firstSeenAt", "lastSeenAt",
                "createdAt", "updatedAt"
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
                $31,$32,'ACTIVE'::"ListingStatus",NOW(),NOW(),NOW(),NOW()
            )
        """,
            new_id,
            source_id,
            listing.source_listing_id,
            listing.listing_url,
            listing.title,
            listing.description,
            listing.industry,
            listing.industry,   # industryNormalized — same for now
            listing.business_type,
            listing.asking_price,
            listing.asking_price_raw,
            listing.revenue,
            listing.revenue_raw,
            listing.cash_flow,
            listing.cash_flow_raw,
            listing.cash_flow_type,
            listing.city,
            listing.state,
            listing.state,  # stateCode same as state for US
            listing.country,
            listing.broker_name,
            listing.broker_company,
            listing.broker_phone,
            listing.broker_email,
            listing.seller_financing,
            listing.year_established,
            listing.employees,
            listing.is_absentee_owner,
            listing.is_franchise,
            listing.is_home_based,
            listing.has_real_estate,
            listing.reason_for_selling,
        )
    else:
        # Update price and last seen
        listing_id = existing["id"]
        old_price = existing["askingPrice"]
        new_price = listing.asking_price

        await conn.execute("""
            UPDATE "Listing"
            SET "askingPrice" = COALESCE($2, "askingPrice"),
                "askingPriceRaw" = COALESCE($3, "askingPriceRaw"),
                revenue = COALESCE($4, revenue),
                "revenueRaw" = COALESCE($5, "revenueRaw"),
                "cashFlow" = COALESCE($6, "cashFlow"),
                "cashFlowRaw" = COALESCE($7, "cashFlowRaw"),
                "lastSeenAt" = NOW(),
                "priceChangedAt" = CASE
                    WHEN $2 IS NOT NULL AND $2 != "askingPrice" THEN NOW()
                    ELSE "priceChangedAt"
                END,
                "previousPrice" = CASE
                    WHEN $2 IS NOT NULL AND $2 != "askingPrice" THEN "askingPrice"
                    ELSE "previousPrice"
                END,
                "updatedAt" = NOW()
            WHERE id = $1
        """,
            listing_id,
            new_price,
            listing.asking_price_raw,
            listing.revenue,
            listing.revenue_raw,
            listing.cash_flow,
            listing.cash_flow_raw,
        )

    return "new" if is_new else "updated"
