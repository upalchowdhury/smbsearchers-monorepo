import { BaseScraper, RawListing } from './base';
import { Page } from 'playwright';

export class AcquireScraper extends BaseScraper {
    sourceName = 'acquire';
    baseUrl = 'https://acquire.com';

    async *scrapeListingUrls(page: Page): AsyncGenerator<string[]> {
        try {
            await page.goto(`${this.baseUrl}/marketplace`, { waitUntil: 'networkidle', timeout: 60000 });

            let previousCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = this.config.maxPages || 30;

            while (scrollAttempts < maxScrollAttempts) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(2000);

                const loadMore = page.locator('button:has-text("Load More"), button:has-text("Show More")');
                if (await loadMore.isVisible().catch(() => false)) {
                    await loadMore.click();
                    await page.waitForTimeout(3000);
                }

                const urls = await page.evaluate(() => {
                    const links = document.querySelectorAll('a[href*="/startup/"], a[href*="/listing/"]');
                    return Array.from(links).map((a) => (a as HTMLAnchorElement).href);
                });

                if (urls.length === previousCount) break;
                const newUrls = urls.slice(previousCount);
                previousCount = urls.length;
                yield [...new Set(newUrls)];
                scrollAttempts++;
            }
        } catch (error) {
            console.error('[acquire] Failed to load marketplace:', error);
        }
    }

    async scrapeListingDetail(page: Page, url: string): Promise<RawListing | null> {
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            const data = await page.evaluate(() => {
                const nextData = document.querySelector('#__NEXT_DATA__');
                if (nextData) {
                    try { return { type: 'nextdata', data: JSON.parse(nextData.textContent || '') }; } catch { }
                }
                return {
                    type: 'dom',
                    title: document.querySelector('h1')?.textContent?.trim() || '',
                    description: document.querySelector('[class*="description"], [class*="about"]')?.textContent?.trim() || '',
                };
            });

            if (!data) return null;

            const listing: RawListing = {
                sourceListingId: url.split('/').filter(Boolean).pop() || url,
                sourceUrl: url,
                title: '',
                businessType: 'Digital / SaaS',
            };

            if (data.type === 'nextdata' && (data.data as any)?.props?.pageProps) {
                const props = (data.data as any).props.pageProps;
                const l = props.listing || props.startup || props;
                listing.title = l.headline || l.title || l.name || '';
                listing.description = l.description || l.about || '';
                listing.askingPriceRaw = l.askingPrice?.toString() || l.price?.toString();
                listing.revenueRaw = l.ttmRevenue?.toString() || l.revenue?.toString() || l.arr?.toString();
                listing.cashFlowRaw = l.ttmProfit?.toString() || l.profit?.toString();
                listing.cashFlowType = 'Net Profit';
                listing.industry = l.industry || l.category || 'Technology & SaaS';
            } else {
                listing.title = (data as any).title || '';
                listing.description = (data as any).description || '';
                listing.industry = 'Technology & SaaS';
            }

            if (!listing.title || listing.title.length < 3) return null;
            return listing;
        } catch (error) {
            console.error(`[acquire] Detail failed: ${url}`, error);
            return null;
        }
    }
}
