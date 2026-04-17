"""Flippa adapter — TinyFish primary (stealth), browser-use fallback, Playwright tier-1 last resort.

Flippa is heavily bot-protected (Cloudflare), so TinyFish stealth is preferred.
Listing URLs: https://flippa.com/{numeric_id}-{slug}
Search URLs:  https://flippa.com/search?filter[listing_type]=website&page[number]={n}&page[size]=25
"""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier1_playwright import flippa_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://flippa.com"

# Flippa search pages by category — each page returns ~25 listings
SEARCH_PAGES = [
    f"{BASE_URL}/search?filter[listing_type]=established_business&page[number]={{n}}&page[size]=25",
    f"{BASE_URL}/search?filter[listing_type]=website&page[number]={{n}}&page[size]=25",
    f"{BASE_URL}/search?filter[listing_type]=app&page[number]={{n}}&page[size]=25",
]

_tinyfish = TinyFishService()
_browser_use = BrowserUseService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 5,
) -> AsyncGenerator[str, None]:
    """Discover Flippa listing URLs using TinyFish stealth (Cloudflare bypass)."""
    seen: set[str] = set()

    for page_num in range(1, max_pages + 1):
        for search_template in SEARCH_PAGES:
            search_url = search_template.format(n=page_num)
            logger.info("[flippa] Discovering URLs from %s", search_url)

            # TinyFish primary — stealth mode for Cloudflare
            urls: list[str] = []
            if _tinyfish.available():
                urls = await _tinyfish.discover_urls(
                    index_url=search_url,
                    site_name="Flippa",
                    link_pattern="flippa.com/[numeric_id]-[slug] (e.g. flippa.com/12345678-some-business)",
                    use_stealth=True,
                    use_proxy=True,
                )

            # browser-use fallback
            if not urls:
                logger.info("[flippa] TinyFish returned 0, trying browser-use for %s", search_url)
                urls = await _browser_use.discover_urls(
                    index_url=search_url,
                    site_name="Flippa",
                    link_pattern="flippa.com/[numeric_id]-[slug]",
                )

            new_urls = [
                u for u in urls
                if u not in seen
                and "flippa.com/" in u
                and "/search" not in u
                and "/login" not in u
                and re.search(r"/\d+", u)  # must contain a numeric ID
            ]
            if not new_urls:
                continue

            seen.update(new_urls)
            logger.info("[flippa] Page %d (%s): %d new URLs", page_num, search_url.split("listing_type=")[1][:15], len(new_urls))
            for u in new_urls:
                yield u


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    """Scrape a single Flippa listing with TinyFish stealth as primary."""
    # Flippa URLs: flippa.com/12525555-high-performing-content-site...
    m = re.search(r"/(\d+)", url)
    listing_id = m.group(1) if m else url.rstrip("/").split("/")[-1]

    # Tier 3 (TinyFish) — PRIMARY for Flippa (bot protection)
    if force_tier not in ("tier1", "tier2") and _tinyfish.available():
        result = await _tinyfish.extract(
            url=url,
            source_slug="flippa",
            source_listing_id=listing_id,
            use_stealth=True,
            use_proxy=True,
        )
        if result and result.is_valid():
            return result

    # Tier 2: browser-use fallback
    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="flippa", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    # Tier 1: Playwright + BeautifulSoup last resort
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[flippa] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="flippa", source_listing_id=listing_id,
        tier1_fn=flippa_t1, force_tier=force_tier,
        use_tinyfish_stealth=True,
    )
