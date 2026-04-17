"""Quiet Light Brokerage adapter."""
from __future__ import annotations
import logging
import re
from typing import AsyncGenerator, Optional

from core.browser import BrowserService
from core.models import NormalizedListing
from tiers.tier1_playwright import quietlight_t1
from tiers.tier_executor import execute_with_fallback

logger = logging.getLogger(__name__)
BASE_URL = "https://quietlight.com"


async def discover_urls(browser: BrowserService, max_pages: int = 10) -> AsyncGenerator[str, None]:
    async with browser.new_page() as page:
        for page_num in range(1, max_pages + 1):
            url = (
                f"{BASE_URL}/listings/page/{page_num}/"
                if page_num > 1
                else f"{BASE_URL}/listings/"
            )
            logger.info("[quietlight] Page %d: %s", page_num, url)
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                urls = await page.evaluate("""() => {
                    const links = new Set();
                    document.querySelectorAll('a[href]').forEach(a => {
                        const href = a.href;
                        if (href.includes('quietlight.com/listings/') &&
                            !href.endsWith('/listings/') &&
                            !href.includes('/page/') &&
                            href.split('/').length >= 5) {
                            links.add(href);
                        }
                    });
                    return [...links];
                }""")
                if not urls:
                    break
                for u in urls:
                    # Skip anchor-only / navigation URLs
                    if u.endswith("#") or u.endswith("/listings/#") or u == f"{BASE_URL}/listings/":
                        continue
                    yield u
                if len(urls) < 6:
                    break
                await browser.delay()
            except Exception as e:
                logger.error("[quietlight] Page %d failed: %s", page_num, e)
                break


async def scrape_listing(browser: BrowserService, url: str, force_tier: Optional[str] = None) -> NormalizedListing:
    m = re.search(r"/listings/([^/]+)/?$", url)
    listing_id = m.group(1) if m else url.rstrip("/").split("/")[-1]
    async with browser.new_page() as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            html = await page.content()
            text = await page.inner_text("body")
        except Exception as e:
            logger.error("[quietlight] Failed %s: %s", url, e)
            html, text = "", ""
    return await execute_with_fallback(
        html=html, page_text=text, url=url,
        source_slug="quietlight", source_listing_id=listing_id,
        tier1_fn=quietlight_t1, force_tier=force_tier,
    )
