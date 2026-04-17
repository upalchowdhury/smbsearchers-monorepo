"""TransWorld adapter — browser-use primary, TinyFish fallback."""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier1_playwright import transworld_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://www.tworld.com"

_browser_use = BrowserUseService()
_tinyfish = TinyFishService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 50,
) -> AsyncGenerator[str, None]:
    seen: set[str] = set()
    for page_num in range(1, max_pages + 1):
        index_url = (
            f"{BASE_URL}/business-listing/?page={page_num}"
            if page_num > 1
            else f"{BASE_URL}/business-listing/"
        )
        logger.info("[transworld] Discovering URLs from page %d", page_num)

        urls = await _browser_use.discover_urls(
            index_url=index_url,
            site_name="TransWorld Business Advisors",
            link_pattern="tworld.com/listing/ or tworld.com/business/",
        )
        if not urls and _tinyfish.available():
            urls = await _tinyfish.discover_urls(
                index_url=index_url,
                site_name="TransWorld Business Advisors",
                link_pattern="tworld.com/listing/ or tworld.com/business/",
            )
        if not urls:
            break

        new_urls = [u for u in urls if u not in seen and "tworld.com" in u]
        if not new_urls:
            break
        seen.update(new_urls)
        logger.info("[transworld] Page %d: %d new URLs", page_num, len(new_urls))
        for u in new_urls:
            yield u


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    m = re.search(r"/([^/]+?)/?$", url)
    listing_id = m.group(1) if m else url

    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="transworld", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    if force_tier != "tier1" and _tinyfish.available():
        result = await _tinyfish.extract(url=url, source_slug="transworld", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[transworld] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="transworld", source_listing_id=listing_id,
        tier1_fn=transworld_t1, force_tier=force_tier,
    )
