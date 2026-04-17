import * as cheerio from 'cheerio';
import { BaseScraper, RawListing } from './base';
import { Page } from 'playwright';

export class QuietLightScraper extends BaseScraper {
    sourceName = 'quietlight';
    baseUrl = 'https://quietlight.com';

    async *scrapeListingUrls(page: Page): AsyncGenerator<string[]> {
        try {
            await page.goto(`${this.baseUrl}/listings`, { waitUntil: 'networkidle', timeout: 30000 });
            const html = await page.content();
            const $ = cheerio.load(html);

            const urls: string[] = [];
            $('a[href*="/listings/"]').each((_, el) => {
                const href = $(el).attr('href');
                if (href && href !== '/listings/' && href !== '/listings') {
                    urls.push(href.startsWith('http') ? href : `${this.baseUrl}${href}`);
                }
            });

            yield [...new Set(urls)];
        } catch (error) {
            console.error('[quietlight] Failed to load listings:', error);
        }
    }

    async scrapeListingDetail(page: Page, url: string): Promise<RawListing | null> {
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            const html = await page.content();
            const $ = cheerio.load(html);

            const listing: RawListing = {
                sourceListingId: url.split('/').filter(Boolean).pop() || url,
                sourceUrl: url,
                title: $('h1').first().text().trim(),
                description: $('.listing-content, .listing-description, article, .entry-content').first().text().trim(),
                askingPriceRaw: $('dt:contains("Asking") + dd, .asking-price, [class*="price"]').first().text().trim() || undefined,
                cashFlowRaw: $('dt:contains("Cash Flow") + dd, dt:contains("SDE") + dd, dt:contains("EBITDA") + dd').first().text().trim() || undefined,
                revenueRaw: $('dt:contains("Revenue") + dd, dt:contains("Gross") + dd').first().text().trim() || undefined,
                industry: $('[class*="category"], [class*="type"]').first().text().trim() || undefined,
                businessType: 'Digital / Online',
                brokerCompany: 'Quiet Light Brokerage',
            };

            if (!listing.title || listing.title.length < 3) return null;
            return listing;
        } catch (error) {
            console.error(`[quietlight] Detail failed: ${url}`, error);
            return null;
        }
    }
}
