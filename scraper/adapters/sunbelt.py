"""Sunbelt Network adapter — TinyFish primary, browser-use fallback, Playwright tier-1 last resort.

Sunbelt Network is one of the world's largest business brokerage networks.

  Search index:  https://www.sunbeltnetwork.com/business-search/business-results/
  Pagination:    https://www.sunbeltnetwork.com/business-search/business-results/page/{n}/
  Listing URL:   https://www.sunbeltnetwork.com/[office-slug]/buy-a-business/listings/listing-details/[slug]-[id]/

NOTE: previous iteration used ?pg=N pagination which is WRONG.
      The correct pattern is /page/N/ on the business-results path.
"""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier3_tinyfish import TinyFishService
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier1_playwright import sunbelt_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)

BASE_URL        = "https://www.sunbeltnetwork.com"
SEARCH_BASE     = f"{BASE_URL}/business-search/business-results/"
# Also try the legacy /businesses-for-sale/ path as a secondary discovery source
LEGACY_INDEX    = f"{BASE_URL}/businesses-for-sale/"

_tinyfish    = TinyFishService()
_browser_use = BrowserUseService()

# Matches: /[office]/buy-a-business/listings/listing-details/[slug]-[id]/
_LISTING_RE = re.compile(
    r"sunbeltnetwork\.com/[^/]+/buy-a-business/listings/listing-details/[^/]+-\d+"
)
# Looser fallback: /listing/[id] or /listing/[id]/[slug]
_LISTING_LEGACY_RE = re.compile(r"sunbeltnetwork\.com/listing/\d+")


def _is_listing_url(u: str) -> bool:
    """Return True if URL looks like a Sunbelt individual listing detail page."""
    return bool(_LISTING_RE.search(u) or _LISTING_LEGACY_RE.search(u))


async def discover_urls(
    browser: BrowserService,
    max_pages: int = 30,
) -> AsyncGenerator[str, None]:
    """Discover Sunbelt Network listing URLs via TinyFish on paginated search results."""
    seen: set[str] = set()

    for page_num in range(1, max_pages + 1):
        # Page 1 → base URL; page 2+ → /page/N/
        index_url = SEARCH_BASE if page_num == 1 else f"{SEARCH_BASE}page/{page_num}/"
        logger.info("[sunbelt] Discovering URLs from page %d: %s", page_num, index_url)

        # ── Tier 3: TinyFish primary (stealth + proxy) ──────────────────────────
        urls: list[str] = []
        if _tinyfish.available():
            urls = await _tinyfish.discover_urls(
                index_url=index_url,
                site_name="Sunbelt Network",
                link_pattern=(
                    "sunbeltnetwork.com/[office]/buy-a-business/listings/listing-details/[slug]-[id] "
                    "e.g. sunbeltnetwork.com/mobile-al/buy-a-business/listings/listing-details/hvac-services-57759"
                ),
                use_stealth=True,
                use_proxy=True,
            )

        # ── Tier 2: browser-use fallback ────────────────────────────────────────
        if not urls:
            logger.info("[sunbelt] TinyFish returned 0 on page %d, trying browser-use", page_num)
            urls = await _browser_use.discover_urls(
                index_url=index_url,
                site_name="Sunbelt Network",
                link_pattern=(
                    "sunbeltnetwork.com/[office]/buy-a-business/listings/listing-details/[slug]-[id]"
                ),
            )

        # ── Tier 1: Playwright direct link extraction ────────────────────────────
        if not urls:
            logger.info("[sunbelt] Trying Playwright direct extraction on page %d", page_num)
            async with browser.new_page() as page:
                try:
                    await page.goto(index_url, wait_until="networkidle", timeout=45_000)
                    # Extra wait to allow JS rendering
                    await page.wait_for_timeout(2000)
                    urls = await page.evaluate("""() => {
                        const links = new Set();
                        document.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            // Match listing-details pattern
                            if (href.includes('/buy-a-business/listings/listing-details/') ||
                                href.includes('/listing/')) {
                                links.add(href);
                            }
                        });
                        return [...links];
                    }""")
                except Exception as e:
                    logger.error("[sunbelt] Playwright page %d failed: %s", page_num, e)
                    urls = []

        if not urls:
            logger.info("[sunbelt] No URLs found on page %d, stopping", page_num)
            break

        new_urls = [u for u in urls if _is_listing_url(u) and u not in seen]
        if not new_urls:
            logger.info("[sunbelt] No new listing URLs on page %d, stopping", page_num)
            break

        seen.update(new_urls)
        logger.info("[sunbelt] Page %d: %d new listing URLs", page_num, len(new_urls))
        for u in new_urls:
            yield u

        await browser.delay()


async def scrape_listing(
    browser: BrowserService,
    url: str,
    force_tier: Optional[str] = None,
) -> NormalizedListing:
    """Scrape a single Sunbelt Network listing page."""
    # Extract numeric ID from slug: .../slug-name-12345/
    m = re.search(r"-(\d+)/?$", url.rstrip("/"))
    # Fallback to legacy /listing/[id]/ pattern
    if not m:
        m = re.search(r"/listing/(\d+)", url)
    listing_id = m.group(1) if m else url.rstrip("/").split("/")[-1]

    # ── Tier 3: TinyFish primary ─────────────────────────────────────────────
    if force_tier not in ("tier1", "tier2") and _tinyfish.available():
        result = await _tinyfish.extract(
            url=url,
            source_slug="sunbelt",
            source_listing_id=listing_id,
            use_stealth=True,
            use_proxy=True,
        )
        if result and result.is_valid():
            return result

    # ── Tier 2: browser-use fallback ─────────────────────────────────────────
    if force_tier not in ("tier1", "tier3"):
        result = await _browser_use.extract(
            url=url, source_slug="sunbelt", source_listing_id=listing_id
        )
        if result and result.is_valid():
            return result

    # ── Tier 1: Playwright + BeautifulSoup ───────────────────────────────────
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[sunbelt] Playwright failed %s: %s", url, e)
            html, text = "", ""

    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="sunbelt", source_listing_id=listing_id,
        tier1_fn=sunbelt_t1, force_tier=force_tier,
    )
