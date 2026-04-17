import asyncio
from core.db import get_pool, upsert_listing
from core.models import NormalizedListing

dummy_listings = [
    NormalizedListing(
        title='Highly Profitable B2B SaaS in the HR Tech Space',
        description='This is a well-established SaaS business...',
        asking_price=250000000,
        revenue=80000000,
        cash_flow=65000000,
        cash_flow_type="SDE",
        industry='Technology & SaaS',
        city='Austin',
        state='TX',
        country='US',
        source_slug='bizbuysell',
        source_listing_id='dummy-bbs-1',
        listing_url='https://www.bizbuysell.com/dummy-1'
    ),
    NormalizedListing(
        title='Commercial HVAC Service Business',
        description='Provider of commercial HVAC installation...',
        asking_price=120000000,
        revenue=210000000,
        cash_flow=40000000,
        cash_flow_type="SDE",
        industry='Construction',
        city='Phoenix',
        state='AZ',
        country='US',
        source_slug='bizbuysell',
        source_listing_id='dummy-bbs-2',
        listing_url='https://www.bizbuysell.com/dummy-2'
    ),
    NormalizedListing(
        title='E-commerce Brand: Specialized Outdoor Gear',
        description='Direct-to-consumer brand...',
        asking_price=85000000,
        revenue=140000000,
        cash_flow=35000000,
        cash_flow_type="EBITDA",
        industry='E-commerce',
        city='Denver',
        state='CO',
        country='US',
        source_slug='bizquest',
        source_listing_id='dummy-bq-1',
        listing_url='https://www.bizquest.com/dummy-1'
    ),
    NormalizedListing(
        title='AI-Powered Content Generation Tool',
        description='Micro-SaaS utilizing advanced LLMs...',
        asking_price=150000000,
        revenue=30000000,
        cash_flow=28000000,
        cash_flow_type="Net Profit",
        industry='Technology & SaaS',
        city='San Francisco',
        state='CA',
        country='US',
        source_slug='acquire',
        source_listing_id='dummy-acq-1',
        listing_url='https://acquire.com/dummy-1'
    ),
    NormalizedListing(
        title='Shopify App for Inventory Expansion',
        description='Top-rated application...',
        asking_price=95000000,
        revenue=25000000,
        cash_flow=22000000,
        cash_flow_type="Net Profit",
        industry='Technology & SaaS',
        city='New York',
        state='NY',
        country='US',
        source_slug='acquire',
        source_listing_id='dummy-acq-2',
        listing_url='https://acquire.com/dummy-2'
    )
]

async def main():
    pool = await get_pool()
    async with pool.acquire() as conn:
        for listing in dummy_listings:
            # Upsert into db
            # We need to get source_id first
            source_id = await conn.fetchval(
                'SELECT id FROM "Source" WHERE name = $1', listing.source_slug
            )
            if not source_id:
                print(f"Skipping {listing.source_slug}, source not found")
                continue
            
            # create run_id just as dummy
            run_id = await conn.fetchval(
                'INSERT INTO "ScrapeRun" ("id", "sourceId", "status") VALUES (gen_random_uuid()::text, $1, $2) RETURNING id',
                source_id, 'COMPLETED'
            )

            res = await upsert_listing(conn, listing, source_id, run_id)
            print(f"Upserted {listing.title}: {res}")

if __name__ == '__main__':
    asyncio.run(main())
