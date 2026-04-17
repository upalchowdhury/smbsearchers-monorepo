import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { SCRAPERS } from '../scrapers/index';
import { normalizeListing } from '../pipeline/normalizer';
import { deduplicateListings } from '../pipeline/deduplicator';
import Redis from 'ioredis';
import { invalidateByPrefix } from '../lib/redis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

async function invalidateDealsCache() {
    const removed = await invalidateByPrefix('deals:v1:');
    if (removed > 0) {
        console.log(`[cache] Invalidated ${removed} deals cache key(s)`);
    }
}

// ---- Scrape Worker ----
export const scrapeWorker = new Worker('scrape', async (job: Job) => {
    const { source: sourceName } = job.data;
    console.log(`[scrape-worker] Starting scrape for: ${sourceName}`);

    const source = await prisma.source.findUnique({ where: { name: sourceName } });
    if (!source || !source.isActive) {
        console.log(`[scrape-worker] Source ${sourceName} not found or inactive, skipping.`);
        return;
    }

    const ScraperClass = SCRAPERS[sourceName];
    if (!ScraperClass) throw new Error(`No scraper for: ${sourceName}`);

    const run = await prisma.scrapeRun.create({
        data: { sourceId: source.id, status: 'RUNNING', startedAt: new Date() },
    });

    let found = 0, newCount = 0, updated = 0;

    try {
        const config = (source.config as any) || {};
        const maxPages = parseInt(process.env.SCRAPE_MAX_PAGES || '5');
        const scraper = new ScraperClass({ ...config, maxPages });

        for await (const rawListing of scraper.scrape()) {
            found++;
            const normalized = normalizeListing(rawListing);

            const existing = await prisma.listing.findUnique({
                where: { sourceId_sourceListingId: { sourceId: source.id, sourceListingId: normalized.sourceListingId } },
            });

            if (existing) {
                const updateData: any = {
                    ...normalized,
                    lastSeenAt: new Date(),
                    status: 'ACTIVE',
                };
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

            await job.updateProgress(found);
        }

        // Mark listings not seen in 7 days as potentially delisted
        if (found > 10) {
            await prisma.listing.updateMany({
                where: {
                    sourceId: source.id,
                    lastSeenAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    status: 'ACTIVE',
                },
                data: { status: 'DELISTED' },
            });
        }

        await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: 'COMPLETED', completedAt: new Date(), listingsFound: found, listingsNew: newCount, listingsUpdated: updated },
        });
        await prisma.source.update({ where: { id: source.id }, data: { lastScraped: new Date() } });
        await invalidateDealsCache();

        console.log(`[scrape-worker] ${sourceName}: found=${found}, new=${newCount}, updated=${updated}`);
        return { found, new: newCount, updated };
    } catch (error: any) {
        console.error(`[scrape-worker] ${sourceName} failed:`, error);
        await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: 'FAILED', completedAt: new Date(), errorMessage: error.message },
        });
        throw error;
    }
}, { connection: redis as any, concurrency: 1 });

// ---- Dedup Worker ----
export const dedupWorker = new Worker('dedup', async () => {
    console.log('[dedup-worker] Starting deduplication...');
    const result = await deduplicateListings();
    await invalidateDealsCache();
    console.log(`[dedup-worker] Done. Merged: ${result.merged}`);
    return result;
}, { connection: redis as any, concurrency: 1 });

// ---- Alerts Worker ----
export const alertWorker = new Worker('alerts', async (job: Job) => {
    const { frequency } = job.data;
    console.log(`[alert-worker] Processing ${frequency} alerts...`);
    // TODO: Implement email alerts
    const savedSearches = await prisma.savedSearch.findMany({
        where: { alertEnabled: true, alertFrequency: frequency },
        include: { user: true },
    });
    console.log(`[alert-worker] Found ${savedSearches.length} searches to alert.`);
    // Placeholder - alert sending would go here
    return { processed: savedSearches.length };
}, { connection: redis as any, concurrency: 1 });

// Event handlers
scrapeWorker.on('completed', (job) => console.log(`[scrape-worker] Job ${job.id} completed.`));
scrapeWorker.on('failed', (job, err) => console.error(`[scrape-worker] Job ${job?.id} failed:`, err.message));
dedupWorker.on('completed', () => console.log('[dedup-worker] Job completed.'));
alertWorker.on('completed', () => console.log('[alert-worker] Job completed.'));
