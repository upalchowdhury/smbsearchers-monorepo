import { Page, Browser, chromium } from 'playwright';

export interface RawListing {
    sourceListingId: string;
    sourceUrl: string;
    title: string;
    description?: string;
    askingPriceRaw?: string;
    revenueRaw?: string;
    cashFlowRaw?: string;
    cashFlowType?: string;
    industry?: string;
    businessType?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    brokerName?: string;
    brokerCompany?: string;
    brokerPhone?: string;
    brokerEmail?: string;
    yearEstablished?: number;
    employees?: number;
    isFranchise?: boolean;
    sellerFinancing?: boolean;
    isAbsenteeOwner?: boolean;
    isHomeBased?: boolean;
    hasRealEstate?: boolean;
    reasonForSelling?: string;
    [key: string]: any;
}

export interface ScraperConfig {
    maxPages?: number;
    delayMs?: number;
    maxRetries?: number;
    proxy?: string;
    userAgent?: string;
    headless?: boolean;
    categories?: string[];
    states?: string[];
}

export abstract class BaseScraper {
    protected config: ScraperConfig;
    protected browser: Browser | null = null;

    abstract sourceName: string;
    abstract baseUrl: string;

    constructor(config: ScraperConfig = {}) {
        this.config = {
            maxPages: 50,
            delayMs: 2000,
            maxRetries: 3,
            headless: true,
            ...config,
        };
    }

    abstract scrapeListingUrls(page: Page): AsyncGenerator<string[]>;
    abstract scrapeListingDetail(page: Page, url: string): Promise<RawListing | null>;

    async initialize(): Promise<void> {
        this.browser = await chromium.launch({
            headless: this.config.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });
    }

    async cleanup(): Promise<void> {
        if (this.browser) await this.browser.close();
    }

    async *scrape(): AsyncGenerator<RawListing> {
        await this.initialize();
        try {
            const context = await this.browser!.newContext({
                userAgent: this.config.userAgent || this.getRandomUserAgent(),
                viewport: { width: 1920, height: 1080 },
            });

            const page = await context.newPage();
            await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', (r) => r.abort());
            await page.route('**/analytics**', (r) => r.abort());
            await page.route('**/tracking**', (r) => r.abort());

            let totalScraped = 0;
            for await (const urls of this.scrapeListingUrls(page)) {
                for (const url of urls) {
                    try {
                        await this.delay();
                        const listing = await this.scrapeListingDetail(page, url);
                        if (listing) {
                            totalScraped++;
                            yield listing;
                        }
                    } catch (error) {
                        console.error(`[${this.sourceName}] Failed to scrape ${url}:`, error);
                    }
                }
            }
            console.log(`[${this.sourceName}] Scrape complete. Total: ${totalScraped}`);
        } finally {
            await this.cleanup();
        }
    }

    protected async delay(): Promise<void> {
        const jitter = Math.random() * 1000;
        await new Promise((r) => setTimeout(r, (this.config.delayMs || 2000) + jitter));
    }

    protected getRandomUserAgent(): string {
        const agents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }
}
