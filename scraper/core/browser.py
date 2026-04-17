"""Playwright browser service with anti-detection, UA rotation, and resource blocking."""
from __future__ import annotations
import asyncio
import logging
import random
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

from .config import settings

logger = logging.getLogger(__name__)

_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

# Resource types to block (images, fonts, media save bandwidth)
_BLOCK_RESOURCE_TYPES = {"image", "font", "media"}
# Domains to block (analytics, tracking, ads)
_BLOCK_DOMAINS = {
    "google-analytics.com", "googletagmanager.com", "doubleclick.net",
    "facebook.com/tr", "hotjar.com", "segment.io", "mixpanel.com",
    "optimizely.com", "newrelic.com", "fullstory.com", "intercom.io",
}


class BrowserService:
    """Manages browser lifecycle with stealth settings and resource blocking."""

    def __init__(self):
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None

    async def start(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.playwright_headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080",
                "--disable-extensions",
                "--ignore-certificate-errors",
            ],
        )
        logger.info("Browser launched (headless=%s)", settings.playwright_headless)

    async def stop(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("Browser closed")

    @asynccontextmanager
    async def new_context(self, **kwargs) -> AsyncGenerator[BrowserContext, None]:
        ua = random.choice(_USER_AGENTS)
        ctx = await self._browser.new_context(
            user_agent=ua,
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
            java_script_enabled=True,
            **kwargs,
        )
        # Inject anti-detection overrides
        await ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {}, loadTimes: () => {} };
        """)
        try:
            yield ctx
        finally:
            await ctx.close()

    @asynccontextmanager
    async def new_page(self, **ctx_kwargs) -> AsyncGenerator[Page, None]:
        async with self.new_context(**ctx_kwargs) as ctx:
            page = await ctx.new_page()

            async def _handle_route(route, request):
                resource_type = request.resource_type
                url = request.url
                if resource_type in _BLOCK_RESOURCE_TYPES:
                    await route.abort()
                    return
                if any(d in url for d in _BLOCK_DOMAINS):
                    await route.abort()
                    return
                await route.continue_()

            await page.route("**/*", _handle_route)
            try:
                yield page
            finally:
                await page.close()

    async def delay(self, base_ms: Optional[int] = None) -> None:
        """Human-like delay with jitter."""
        base = base_ms or settings.scrape_delay_ms
        jitter = random.randint(0, 1500)
        await asyncio.sleep((base + jitter) / 1000)


# Module-level singleton for convenience
_service: Optional[BrowserService] = None


async def get_browser() -> BrowserService:
    global _service
    if _service is None:
        _service = BrowserService()
        await _service.start()
    return _service


async def shutdown_browser() -> None:
    global _service
    if _service:
        await _service.stop()
        _service = None
