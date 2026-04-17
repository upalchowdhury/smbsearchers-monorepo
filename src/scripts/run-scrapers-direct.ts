import { PrismaClient } from '@prisma/client';
import { SCRAPERS } from '../scrapers/index';
import { normalizeListing } from '../pipeline/normalizer';

const prisma = new PrismaClient();
const sources = ['bizbuysell', 'bizquest', 'acquire'];
const maxPages = 5;

async function main() {
    console.log('[Direct Scrape] Starting for sources:', sources.join(', '));
    for (const sourceName of sources) {
        console.log(`\n--- Scraping ${sourceName} ---`);
        const source = await prisma.source.findUnique({ where: { name: sourceName } });
        if (!source) {
            console.log(`Source ${sourceName} not found in DB. Skipping.`);
            continue;
        }

        const ScraperClass = SCRAPERS[sourceName];
        if (!ScraperClass) {
            console.log(`No scraper implementation for: ${sourceName}. Skipping.`);
            continue;
        }

        const run = await prisma.scrapeRun.create({
            data: { sourceId: source.id, status: 'RUNNING', startedAt: new Date() },
        });

        let found = 0, newCount = 0, updated = 0;
        try {
            const config = (source.config as any) || {};
            const scraper = new ScraperClass({ ...config, maxPages, headless: false });

            for await (const rawListing of scraper.scrape()) {
                found++;
                const normalized = normalizeListing(rawListing);

                const existing = await prisma.listing.findUnique({
                    where: { sourceId_sourceListingId: { sourceId: source.id, sourceListingId: normalized.sourceListingId } },
                });

                if (existing) {
                    const updateData: any = { ...normalized, lastSeenAt: new Date(), status: 'ACTIVE' };
                    if (existing.askingPrice !== normalized.askingPrice && normalized.askingPrice) {
                        updateData.previousPrice = existing.askingPrice;
                        updateData.priceChangedAt = new Date();
                    }
                    await prisma.listing.update({ where: { id: existing.id }, data: updateData });
                    updated++;
                } else {
                    await prisma.listing.create({
                        data: { ...normalized, sourceId: source.id, status: 'ACTIVE', firstSeenAt: new Date(), lastSeenAt: new Date() },
                    });
                    newCount++;
                }
            }

            await prisma.scrapeRun.update({
                where: { id: run.id },
                data: { status: 'COMPLETED', completedAt: new Date(), listingsFound: found, listingsNew: newCount, listingsUpdated: updated },
            });
            await prisma.source.update({ where: { id: source.id }, data: { lastScraped: new Date() } });

            console.log(`✅ ${sourceName} completed: found=${found}, new=${newCount}, updated=${updated}`);
        } catch (error: any) {
            console.error(`❌ ${sourceName} failed:`, error.message);
            await prisma.scrapeRun.update({
                where: { id: run.id },
                data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
            });
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
