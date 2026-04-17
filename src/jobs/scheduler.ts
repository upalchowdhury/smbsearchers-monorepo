import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// ---- Queues ----
export const scrapeQueue = new Queue('scrape', { connection: redis as any });
export const dedupQueue = new Queue('dedup', { connection: redis as any });
export const alertQueue = new Queue('alerts', { connection: redis as any });

export async function setupSchedules() {
    // Remove existing repeatable jobs first
    for (const job of await scrapeQueue.getRepeatableJobs()) {
        await scrapeQueue.removeRepeatableByKey(job.key);
    }
    for (const job of await dedupQueue.getRepeatableJobs()) {
        await dedupQueue.removeRepeatableByKey(job.key);
    }
    for (const job of await alertQueue.getRepeatableJobs()) {
        await alertQueue.removeRepeatableByKey(job.key);
    }

    // Scrape schedules
    await scrapeQueue.add('scrape-bizbuysell', { source: 'bizbuysell' }, {
        repeat: { pattern: '0 */6 * * *' },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-bizquest', { source: 'bizquest' }, {
        repeat: { pattern: '0 1,7,13,19 * * *' },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-acquire', { source: 'acquire' }, {
        repeat: { pattern: '0 2,14 * * *' },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-transworld', { source: 'transworld' }, {
        repeat: { pattern: '0 3 * * *' },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-quietlight', { source: 'quietlight' }, {
        repeat: { pattern: '0 4 * * *' },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-flippa', { source: 'flippa' }, {
        repeat: { pattern: '0 5,11,17,23 * * *' },  // every 6h, offset from bizbuysell
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-websiteclosers', { source: 'websiteclosers' }, {
        repeat: { pattern: '30 2 * * *' },  // daily at 2:30 AM
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-sunbelt', { source: 'sunbelt' }, {
        repeat: { pattern: '30 3 * * *' },  // daily at 3:30 AM
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    await scrapeQueue.add('scrape-moxie', { source: 'moxie' }, {
        repeat: { pattern: '0 4 * * 1,4' },  // twice a week Mon+Thu at 4 AM (small site)
        removeOnComplete: 10,
        removeOnFail: 50,
    });

    // Dedup runs 30 min after scrape
    await dedupQueue.add('dedup', {}, {
        repeat: { pattern: '30 */6 * * *' },
        removeOnComplete: 5,
        removeOnFail: 10,
    });

    // Alerts
    await alertQueue.add('process-daily-alerts', { frequency: 'DAILY' }, {
        repeat: { pattern: '0 8 * * *' },
        removeOnComplete: 5,
        removeOnFail: 10,
    });

    console.log('[scheduler] Schedules configured.');
}
