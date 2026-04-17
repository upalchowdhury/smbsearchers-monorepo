"""Acquire.com adapter — browser-use primary, TinyFish fallback (React SPA)."""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier1_playwright import acquire_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://acquire.com"

# Acquire category pages — AI agent can interact with the React SPA
CATEGORY_URLS = [
    f"{BASE_URL}/marketplace/?category=saas",
    f"{BASE_URL}/marketplace/?category=ecommerce",
    f"{BASE_URL}/marketplace/?category=apps",
    f"{BASE_URL}/marketplace/?category=content",
    f"{BASE_URL}/marketplace/?category=amazon-fba",
]

_browser_use = BrowserUseService()
_tinyfish = TinyFishService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 5,
) -> AsyncGenerator[str, None]:
    seen: set[str] = set()
    categories = CATEGORY_URLS[:max_pages]

    for category_url in categories:
        logger.info("[acquire] Discovering URLs from %s", category_url)

        urls = await _browser_use.discover_urls(
            index_url=category_url,
            site_name="Acquire.com",
            link_pattern="acquire.com/businesses/[slug] or acquire.com/[category]/[slug]",
        )
        if not urls and _tinyfish.available():
            urls = await _tinyfish.discover_urls(
                index_url=category_url,
                site_name="Acquire.com",
                link_pattern="acquire.com/businesses/[slug]",
            )

        new_urls = [u for u in urls if u not in seen and "acquire.com" in u]
        if new_urls:
            seen.update(new_urls)
            logger.info("[acquire] %s: %d new URLs", category_url, len(new_urls))
            for u in new_urls:
                yield u


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    m = re.search(r"/([^/]+?)/?$", url)
    listing_id = m.group(1) if m else url.split("/")[-1]

    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="acquire", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    if force_tier != "tier1" and _tinyfish.available():
        result = await _tinyfish.extract(url=url, source_slug="acquire", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[acquire] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="acquire", source_listing_id=listing_id,
        tier1_fn=acquire_t1, force_tier=force_tier,
    )
