"""WebsiteClosers adapter — TinyFish primary, browser-use fallback, Playwright tier-1 last resort.

WebsiteClosers is a Florida-based digital business brokerage.
  Index:   https://www.websiteclosers.com/businesses-for-sale/
  Paginate: https://www.websiteclosers.com/businesses-for-sale/page/{n}/
  Listing: https://www.websiteclosers.com/businesses/[slug]/
             (observed in browser: /businesses/ not /listing/)
"""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier1_playwright import websiteclosers_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://www.websiteclosers.com"
INDEX_URL = f"{BASE_URL}/businesses-for-sale/"

_tinyfish = TinyFishService()
_browser_use = BrowserUseService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 20,
) -> AsyncGenerator[str, None]:
    """Discover WebsiteClosers listing URLs via TinyFish on paginated index."""
    seen: set[str] = set()

    for page_num in range(1, max_pages + 1):
        index_url = (
            f"{INDEX_URL}page/{page_num}/"
            if page_num > 1
            else INDEX_URL
        )
        logger.info("[websiteclosers] Discovering URLs from page %d", page_num)

        # TinyFish primary
        urls: list[str] = []
        if _tinyfish.available():
            urls = await _tinyfish.discover_urls(
                index_url=index_url,
                site_name="WebsiteClosers",
                link_pattern="websiteclosers.com/businesses/[slug] (individual listing pages)",
                use_stealth=True,
                use_proxy=True,
            )

        # browser-use fallback
        if not urls:
            logger.info("[websiteclosers] TinyFish returned 0 on page %d, trying browser-use", page_num)
            urls = await _browser_use.discover_urls(
                index_url=index_url,
                site_name="WebsiteClosers",
                link_pattern="websiteclosers.com/businesses/[slug]",
            )

        # Playwright direct fallback
        if not urls:
            logger.info("[websiteclosers] Falling back to Playwright on page %d", page_num)
            async with browser.new_page() as page:
                try:
                    await page.goto(index_url, wait_until="domcontentloaded", timeout=30_000)
                    urls = await page.evaluate("""() => {
                        const links = new Set();
                        document.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            if (href.includes('websiteclosers.com/businesses/') &&
                                href.split('/').length >= 5) {
                                links.add(href);
                            }
                        });
                        return [...links];
                    }""")
                except Exception as e:
                    logger.error("[websiteclosers] Playwright page %d failed: %s", page_num, e)
                    urls = []

        if not urls:
            logger.info("[websiteclosers] No URLs found on page %d, stopping", page_num)
            break

        new_urls = [
            u for u in urls
            if u not in seen
            and "websiteclosers.com/businesses/" in u
        ]
        if not new_urls:
            logger.info("[websiteclosers] No new listing URLs on page %d, stopping", page_num)
            break

        seen.update(new_urls)
        logger.info("[websiteclosers] Page %d: %d new URLs", page_num, len(new_urls))
        for u in new_urls:
            yield u

        await browser.delay()


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    """Scrape a single WebsiteClosers listing page."""
    # URL: websiteclosers.com/businesses/sba-pre-qualified-dtc-ecommerce-jewelry-brand/
    m = re.search(r"/businesses/([^/]+?)/?$", url)
    listing_id = m.group(1) if m else url.rstrip("/").split("/")[-1]

    # Tier 3: TinyFish primary
    if force_tier not in ("tier1", "tier2") and _tinyfish.available():
        result = await _tinyfish.extract(
            url=url,
            source_slug="websiteclosers",
            source_listing_id=listing_id,
            use_stealth=True,
            use_proxy=True,
        )
        if result and result.is_valid():
            return result

    # Tier 2: browser-use fallback
    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="websiteclosers", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    # Tier 1: Playwright + BeautifulSoup
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[websiteclosers] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="websiteclosers", source_listing_id=listing_id,
        tier1_fn=websiteclosers_t1, force_tier=force_tier,
    )
