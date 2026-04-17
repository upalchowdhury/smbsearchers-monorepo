import { SCRAPERS } from '../scrapers/index';
import { normalizeListing } from '../pipeline/normalizer';

const sourceName = process.argv[2] || 'bizbuysell';
const maxPages = parseInt(process.argv[3] || '2');

async function main() {
    console.log(`\nTest scraping: ${sourceName} (max ${maxPages} pages)\n`);

    const ScraperClass = SCRAPERS[sourceName];
    if (!ScraperClass) {
        console.error(`Unknown source: ${sourceName}`);
        console.error(`Available: ${Object.keys(SCRAPERS).join(', ')}`);
        process.exit(1);
    }

    const scraper = new ScraperClass({ maxPages, delayMs: 1000, headless: true });
    let count = 0;

    try {
        for await (const rawListing of scraper.scrape()) {
            count++;
            const normalized = normalizeListing(rawListing);
            console.log(`\n[${count}] ${normalized.title}`);
            console.log(`    URL: ${normalized.sourceUrl}`);
            console.log(`    Price: $${normalized.askingPrice ? Number(normalized.askingPrice) / 100 : 'N/A'}`);
            console.log(`    Revenue: $${normalized.revenue ? Number(normalized.revenue) / 100 : 'N/A'}`);
            console.log(`    Industry: ${normalized.industryNormalized}`);
            console.log(`    Location: ${normalized.city}, ${normalized.stateCode}`);
            if (count >= 5) {
                console.log('\n... (showing first 5 listings)');
                break;
            }
        }
    } catch (err) {
        console.error('Scrape failed:', err);
    }

    console.log(`\nTotal scraped: ${count}`);
}

main().catch(console.error);
