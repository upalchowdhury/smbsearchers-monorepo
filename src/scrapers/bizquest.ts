import * as cheerio from 'cheerio';
import { BaseScraper, RawListing } from './base';
import { Page } from 'playwright';

export class BizQuestScraper extends BaseScraper {
    sourceName = 'bizquest';
    baseUrl = 'https://www.bizquest.com';

    async *scrapeListingUrls(page: Page): AsyncGenerator<string[]> {
        let pageNum = 1;
        const pageSize = 24;

        while (pageNum <= (this.config.maxPages || 100)) {
            try {
                const url = `${this.baseUrl}/buy-a-business/?page=${pageNum}`;
                console.log(`[bizquest] Page ${pageNum}: ${url}`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const html = await page.content();
                const $ = cheerio.load(html);

                const urls: string[] = [];
                $('a[href*="/buy-a-business/"]').each((_, el) => {
                    const href = $(el).attr('href');
                    if (href && href !== '/buy-a-business/' && href.split('/').length > 3) {
                        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                        urls.push(fullUrl);
                    }
                });

                const unique = [...new Set(urls)];
                if (unique.length === 0) break;
                yield unique;
                pageNum++;

                if (unique.length < pageSize) break;
            } catch (error) {
                console.error(`[bizquest] Page ${pageNum} failed:`, error);
                break;
            }
        }
    }

    async scrapeListingDetail(page: Page, url: string): Promise<RawListing | null> {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const html = await page.content();
            const $ = cheerio.load(html);

            const idMatch = url.match(/\/([^\/]+)\/?$/);
            const listing: RawListing = {
                sourceListingId: idMatch?.[1] || url,
                sourceUrl: url,
                title: $('h1').first().text().trim(),
                description: $('[class*="description"], [class*="about"], article').first().text().trim(),
            };

            $('dt').each((_, el) => {
                const label = $(el).text().trim().toLowerCase();
                const value = $(el).next('dd').text().trim();
                if (label.includes('asking price') || label.includes('price')) listing.askingPriceRaw = value;
                else if (label.includes('cash flow')) { listing.cashFlowRaw = value; listing.cashFlowType = 'Cash Flow'; }
                else if (label.includes('gross revenue') || label.includes('revenue')) listing.revenueRaw = value;
                else if (label.includes('ebitda')) { listing.cashFlowRaw = value; listing.cashFlowType = 'EBITDA'; }
                else if (label.includes('established')) listing.yearEstablished = parseInt(value) || undefined;
                else if (label.includes('employees')) listing.employees = parseInt(value) || undefined;
            });

            const loc = $('[class*="location"]').first().text().trim();
            if (loc) {
                const parts = loc.split(',').map(s => s.trim());
                if (parts.length >= 2) { listing.city = parts[0]; listing.state = parts[parts.length - 1]; }
            }

            listing.industry = $('[class*="category"], [class*="industry"]').first().text().trim() || undefined;
            listing.brokerCompany = $('[class*="broker"], [class*="company"]').first().text().trim() || undefined;

            if (!listing.title || listing.title.length < 3) return null;
            return listing;
        } catch (error) {
            console.error(`[bizquest] Detail failed: ${url}`, error);
            return null;
        }
    }
}
