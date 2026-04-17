"""BizBuySell adapter — browser-use primary, TinyFish fallback (Cloudflare protected)."""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier1_playwright import bizbuysell_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://www.bizbuysell.com"

_browser_use = BrowserUseService()
_tinyfish = TinyFishService()


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 50,
) -> AsyncGenerator[str, None]:
    """Discover listing URLs via browser-use (primary) or TinyFish (fallback)."""
    seen: set[str] = set()
    for page_num in range(1, max_pages + 1):
        index_url = f"{BASE_URL}/businesses-for-sale/{page_num}/"
        logger.info("[bizbuysell] Discovering URLs from page %d", page_num)

        # Try browser-use first
        urls = await _browser_use.discover_urls(
            index_url=index_url,
            site_name="BizBuySell",
            link_pattern="bizbuysell.com/business-opportunity/ or /business-auction/",
        )

        # Fallback to TinyFish if browser-use found nothing
        if not urls and _tinyfish.available():
            logger.info("[bizbuysell] browser-use returned 0, trying TinyFish")
            urls = await _tinyfish.discover_urls(
                index_url=index_url,
                site_name="BizBuySell",
                link_pattern="bizbuysell.com/business-opportunity/ or /business-auction/",
            )

        if not urls:
            logger.info("[bizbuysell] No URLs on page %d, stopping", page_num)
            break

        new_urls = [u for u in urls if u not in seen]
        if not new_urls:
            break

        seen.update(new_urls)
        logger.info("[bizbuysell] Page %d: %d new URLs", page_num, len(new_urls))
        for u in new_urls:
            yield u


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    m = re.search(r"/(\d+)/?$", url)
    listing_id = m.group(1) if m else url.split("/")[-2]

    # 1. Try browser-use (real browser, AI-powered, no credits needed)
    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(url=url, source_slug="bizbuysell", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    # 2. Try TinyFish (if credits available)
    if force_tier != "tier1" and _tinyfish.available():
        result = await _tinyfish.extract(url=url, source_slug="bizbuysell", source_listing_id=listing_id)
        if result and result.is_valid():
            return result

    # 3. Playwright fallback
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[bizbuysell] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="bizbuysell", source_listing_id=listing_id,
        tier1_fn=bizbuysell_t1, force_tier=force_tier,
    )
