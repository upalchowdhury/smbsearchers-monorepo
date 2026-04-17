import * as cheerio from 'cheerio';
import { BaseScraper, RawListing } from './base';
import { Page } from 'playwright';

export class TransWorldScraper extends BaseScraper {
    sourceName = 'transworld';
    baseUrl = 'https://www.tworld.com';

    async *scrapeListingUrls(page: Page): AsyncGenerator<string[]> {
        let pageNum = 1;
        while (pageNum <= (this.config.maxPages || 20)) {
            const url = `${this.baseUrl}/buy-a-business?page=${pageNum}`;
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const html = await page.content();
                const $ = cheerio.load(html);

                const urls: string[] = [];
                $('a[href*="/listings/"], a[href*="/buy-a-business/"]').each((_, el) => {
                    const href = $(el).attr('href');
                    if (href && !href.endsWith('/buy-a-business') && !href.endsWith('/buy-a-business/')) {
                        urls.push(href.startsWith('http') ? href : `${this.baseUrl}${href}`);
                    }
                });

                if (urls.length === 0) break;
                yield [...new Set(urls)];
                pageNum++;
            } catch (error) {
                console.error(`[transworld] Page ${pageNum} failed:`, error);
                break;
            }
        }
    }

    async scrapeListingDetail(page: Page, url: string): Promise<RawListing | null> {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const html = await page.content();
            const $ = cheerio.load(html);

            const listing: RawListing = {
                sourceListingId: url.split('/').filter(Boolean).pop() || url,
                sourceUrl: url,
                title: $('h1').first().text().trim(),
                description: $('.listing-description, .description, article').first().text().trim(),
                askingPriceRaw: $('[class*="price"], dt:contains("Price") + dd').first().text().trim() || undefined,
                cashFlowRaw: $('dt:contains("Cash Flow") + dd, dt:contains("SDE") + dd').first().text().trim() || undefined,
                revenueRaw: $('dt:contains("Revenue") + dd, dt:contains("Gross") + dd').first().text().trim() || undefined,
                city: $('[class*="location"], .city, .location').first().text().trim().split(',')[0] || undefined,
                state: $('[class*="location"]').first().text().trim().split(',').pop()?.trim() || undefined,
                brokerCompany: 'TransWorld Business Advisors',
                industry: $('[class*="category"], [class*="industry"]').first().text().trim() || undefined,
            };

            if (!listing.title || listing.title.length < 3) return null;
            return listing;
        } catch (error) {
            console.error(`[transworld] Detail failed: ${url}`, error);
            return null;
        }
    }
}
