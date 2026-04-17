"""Moxie Brokerage Group adapter — TinyFish primary, browser-use fallback, Playwright tier-1 last resort.

Moxie Brokerage Group is a boutique business brokerage.
  Index:   https://www.moxiebrokeragegroup.com/listings
  Listing: https://www.moxiebrokeragegroup.com/listings/[slug]

Smaller site — likely a single-page listing index with no pagination.
"""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier1_playwright import moxie_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://www.moxiebrokeragegroup.com"
INDEX_URL = f"{BASE_URL}/listings"

_tinyfish = TinyFishService()
_browser_use = BrowserUseService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 5,
) -> AsyncGenerator[str, None]:
    """Discover Moxie listing URLs — boutique site, usually a single index page."""
    seen: set[str] = set()

    logger.info("[moxie] Discovering URLs from %s", INDEX_URL)

    # TinyFish primary
    urls: list[str] = []
    if _tinyfish.available():
        urls = await _tinyfish.discover_urls(
            index_url=INDEX_URL,
            site_name="Moxie Brokerage Group",
            link_pattern="moxiebrokeragegroup.com/listings/[slug] (individual listing detail pages)",
            use_stealth=True,
            use_proxy=True,
        )

    # browser-use fallback
    if not urls:
        logger.info("[moxie] TinyFish returned 0, trying browser-use")
        urls = await _browser_use.discover_urls(
            index_url=INDEX_URL,
            site_name="Moxie Brokerage Group",
            link_pattern="moxiebrokeragegroup.com/listings/[slug]",
        )

    # Playwright direct fallback (scroll to load any lazy content)
    if not urls:
        logger.info("[moxie] Falling back to Playwright link extraction on index page")
        async with browser.new_page() as page:
            try:
                await page.goto(INDEX_URL, wait_until="networkidle", timeout=30_000)
                # Scroll to trigger any lazy loading
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1000)
                urls = await page.evaluate("""() => {
                    const links = new Set();
                    document.querySelectorAll('a[href]').forEach(a => {
                        const href = a.href;
                        if (href.includes('moxiebrokeragegroup.com/listings/') &&
                            href.split('/').length >= 5 &&
                            !href.endsWith('/listings') &&
                            !href.endsWith('/listings/')) {
                            links.add(href);
                        }
                    });
                    return [...links];
                }""")
            except Exception as e:
                logger.error("[moxie] Playwright index scrape failed: %s", e)
                urls = []

    new_urls = [
        u for u in urls
        if u not in seen
        and "moxiebrokeragegroup.com/listings/" in u
        and not u.rstrip("/").endswith("/listings")
    ]
    seen.update(new_urls)
    logger.info("[moxie] Discovered %d listing URLs", len(new_urls))
    for u in new_urls:
        yield u

    # Check for pagination pages (max_pages > 1)
    for page_num in range(2, max_pages + 1):
        paged_url = f"{INDEX_URL}?page={page_num}"
        urls = []
        if _tinyfish.available():
            urls = await _tinyfish.discover_urls(
                index_url=paged_url,
                site_name="Moxie Brokerage Group",
                link_pattern="moxiebrokeragegroup.com/listings/[slug]",
                use_stealth=True,
                use_proxy=True,
            )
        if not urls:
            break
        new_urls = [
            u for u in urls
            if u not in seen
            and "moxiebrokeragegroup.com/listings/" in u
        ]
        if not new_urls:
            break
        seen.update(new_urls)
        for u in new_urls:
            yield u


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    """Scrape a single Moxie Brokerage listing page."""
    m = re.search(r"/listings/([^/]+?)/?$", url)
    listing_id = m.group(1) if m else url.rstrip("/").split("/")[-1]

    # Tier 3: TinyFish primary
    if force_tier not in ("tier1", "tier2") and _tinyfish.available():
        result = await _tinyfish.extract(
            url=url,
            source_slug="moxie",
            source_listing_id=listing_id,
            use_stealth=True,
            use_proxy=True,
        )
        if result and result.is_valid():
            return result

    # Tier 2: browser-use fallback
    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="moxie", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    # Tier 1: Playwright + BeautifulSoup
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[moxie] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="moxie", source_listing_id=listing_id,
        tier1_fn=moxie_t1, force_tier=force_tier,
    )
