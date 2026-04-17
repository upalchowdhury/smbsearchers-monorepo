import * as cheerio from 'cheerio';
import { BaseScraper, RawListing } from './base';
import { Page } from 'playwright';

export class BizBuySellScraper extends BaseScraper {
    sourceName = 'bizbuysell';
    baseUrl = 'https://www.bizbuysell.com';

    async *scrapeListingUrls(page: Page): AsyncGenerator<string[]> {
        const categories = ['businesses-for-sale'];

        for (const category of categories) {
            let pageNum = 1;
            while (pageNum <= (this.config.maxPages || 50)) {
                const url = `${this.baseUrl}/${category}/${pageNum}/`;
                console.log(`[bizbuysell] Index page ${pageNum}: ${url}`);
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const html = await page.content();
                    const $ = cheerio.load(html);
                    const urls: string[] = [];

                    $('a[href*="/Business-Opportunity/"]').each((_, el) => {
                        const href = $(el).attr('href');
                        if (href) {
                            const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                            if (!fullUrl.includes('?') || fullUrl.includes('/Business-Opportunity/')) {
                                urls.push(fullUrl);
                            }
                        }
                    });

                    // Also try listing cards
                    $('.listing-card a, .listing a').each((_, el) => {
                        const href = $(el).attr('href');
                        if (href && (href.includes('/Business-Opportunity/') || href.includes('-for-sale-'))) {
                            const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                            urls.push(fullUrl);
                        }
                    });

                    const uniqueUrls = [...new Set(urls)].filter(u =>
                        u.includes('/Business-Opportunity/') || u.match(/bizbuysell\.com\/.*-for-sale-\d+/)
                    );

                    if (uniqueUrls.length === 0) {
                        console.log(`[bizbuysell] No listings on page ${pageNum}, stopping.`);
                        break;
                    }

                    yield uniqueUrls;
                    pageNum++;
                } catch (error) {
                    console.error(`[bizbuysell] Failed page ${pageNum}:`, error);
                    break;
                }
            }
        }
    }

    async scrapeListingDetail(page: Page, url: string): Promise<RawListing | null> {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const html = await page.content();
            const $ = cheerio.load(html);

            const idMatch = url.match(/(\d+)\/?$/);
            if (!idMatch) return null;

            const listing: RawListing = {
                sourceListingId: idMatch[1],
                sourceUrl: url,
                title: $('h1').first().text().trim(),
                description: $('.businessDescription, .listing-description, #business-description, .description').text().trim(),
            };

            // Financial details
            $('dt').each((_, el) => {
                const label = $(el).text().trim().toLowerCase();
                const value = $(el).next('dd').text().trim();

                if (label.includes('asking price')) listing.askingPriceRaw = value;
                else if (label.includes('cash flow')) { listing.cashFlowRaw = value; listing.cashFlowType = 'Cash Flow'; }
                else if (label.includes('gross revenue') || label === 'revenue') listing.revenueRaw = value;
                else if (label.includes('ebitda')) { listing.cashFlowRaw = value; listing.cashFlowType = 'EBITDA'; }
                else if (label.includes('sde')) { listing.cashFlowRaw = value; listing.cashFlowType = 'SDE'; }
                else if (label.includes('established') || label.includes('year')) listing.yearEstablished = parseInt(value) || undefined;
                else if (label.includes('employees')) listing.employees = parseInt(value) || undefined;
                else if (label.includes('franchise')) listing.isFranchise = value.toLowerCase() === 'yes';
                else if (label.includes('seller financing')) listing.sellerFinancing = value.toLowerCase().includes('yes');
                else if (label.includes('real estate')) listing.hasRealEstate = value.toLowerCase().includes('included') || value.toLowerCase() === 'yes';
                else if (label.includes('home-based') || label.includes('home based')) listing.isHomeBased = value.toLowerCase() === 'yes';
                else if (label.includes('absentee')) listing.isAbsenteeOwner = value.toLowerCase() === 'yes';
                else if (label.includes('reason for selling')) listing.reasonForSelling = value;
            });

            // Location
            const locationText = $('.listingLocation, .listing-location, .location, [class*="location"]').first().text().trim();
            if (locationText) {
                const parts = locationText.split(',').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    listing.city = parts[0];
                    listing.state = parts[parts.length - 1];
                }
            }

            // Industry
            listing.industry = $('[class*="category"], .breadcrumb a').last().text().trim() || undefined;

            // Broker
            listing.brokerName = $('[class*="broker-name"], [class*="contact-name"], [class*="agent-name"]').first().text().trim() || undefined;
            listing.brokerCompany = $('[class*="broker-company"], [class*="company-name"]').first().text().trim() || undefined;
            listing.brokerPhone = $('[class*="phone"], [class*="broker-phone"]').first().text().trim() || undefined;

            if (!listing.title || listing.title.length < 3) return null;
            return listing;
        } catch (error) {
            console.error(`[bizbuysell] Detail failed: ${url}`, error);
            return null;
        }
    }
}
