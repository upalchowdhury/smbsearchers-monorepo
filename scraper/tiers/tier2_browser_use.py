"""Tier 2: browser-use AI agent for bot-protected sites.

Uses the browser-use library (https://github.com/browser-use/browser-use)
which controls a real Chromium browser via AI — defeats most bot protection.

Requires: Python 3.11+, browser-use installed in .venv312
Uses ChatBrowserUse (built-in LLM, no API key required) or falls back to
ChatOpenAI/ChatAnthropic if those keys are set.
"""
from __future__ import annotations
import asyncio
import json
import logging
import re
from typing import Optional

from core.config import settings
from core.models import NormalizedListing
from core.normalizer import parse_currency, normalize_state, normalize_industry, clean_text

logger = logging.getLogger(__name__)

# ─── Pydantic models for structured extraction ─────────────────────────────────

try:
    from pydantic import BaseModel

    class ListingData(BaseModel):
        title: str
        description: Optional[str] = None
        asking_price_raw: Optional[str] = None
        revenue_raw: Optional[str] = None
        cash_flow_raw: Optional[str] = None
        cash_flow_type: Optional[str] = None
        employees: Optional[int] = None
        year_established: Optional[int] = None
        city: Optional[str] = None
        state: Optional[str] = None
        industry: Optional[str] = None
        broker_name: Optional[str] = None
        broker_company: Optional[str] = None
        broker_phone: Optional[str] = None
        is_franchise: Optional[bool] = None
        seller_financing: Optional[bool] = None
        reason_for_selling: Optional[str] = None

    class DiscoveryData(BaseModel):
        urls: list[str]

except ImportError:
    ListingData = None
    DiscoveryData = None


def _get_llm():
    """Return the best available LLM for browser-use (must be a browser_use native LLM)."""
    import os

    # 1. browser-use cloud key
    if settings.has_browser_use:
        try:
            os.environ["BROWSER_USE_API_KEY"] = settings.browser_use_api_key
            from browser_use import ChatBrowserUse
            logger.info("[BrowserUse] Using ChatBrowserUse (cloud)")
            return ChatBrowserUse()
        except Exception as e:
            logger.warning("[BrowserUse] ChatBrowserUse failed: %s", e)

    # 2. Google Gemini (native browser_use class — fast and free tier available)
    if settings.has_gemini:
        try:
            from browser_use.llm.google.chat import ChatGoogle
            logger.info("[BrowserUse] Using Gemini 2.0 Flash (native)")
            return ChatGoogle(
                model="gemini-2.0-flash",
                api_key=settings.gemini_api_key,
            )
        except Exception as e:
            logger.warning("[BrowserUse] Gemini failed: %s", e)

    # 3. OpenAI (native browser_use class)
    if settings.has_openai:
        try:
            from browser_use.llm.openai.chat import ChatOpenAI as BUChatOpenAI
            logger.info("[BrowserUse] Using OpenAI gpt-4o-mini (native)")
            return BUChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key)
        except Exception as e:
            logger.warning("[BrowserUse] OpenAI failed: %s", e)

    logger.error("[BrowserUse] No LLM — set OPENAI_API_KEY, GEMINI_API_KEY, or BROWSER_USE_API_KEY in .env")
    return None


# ─── BrowserUseService ─────────────────────────────────────────────────────────

def _make_browser():
    """Create a browser with stealth settings to defeat bot detection / Cloudflare."""
    from browser_use import Browser
    return Browser(
        headless=settings.playwright_headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-gpu",
            "--window-size=1440,900",
        ],
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1440, "height": 900},
        ignore_default_args=["--enable-automation"],
    )


class BrowserUseService:
    """
    Uses browser-use Agent to control a real Chromium browser via AI.
    The Agent can handle JavaScript-heavy SPAs, Cloudflare challenges, and
    React apps that don't expose traditional <a href> links.
    """

    def available(self) -> bool:
        """Check if browser-use can run."""
        try:
            import browser_use  # noqa
            return True
        except ImportError:
            return False

    async def discover_urls(
        self,
        index_url: str,
        site_name: str,
        link_pattern: str,
    ) -> list[str]:
        """
        Navigate to index_url with playwright-stealth (more reliable than browser-use
        for URL discovery) and extract listing URLs from the rendered DOM.
        """
        if not self.available():
            return []

        from urllib.parse import urlparse
        domain = urlparse(index_url).netloc.replace("www.", "")

        try:
            from playwright.async_api import async_playwright
            from playwright_stealth.stealth import Stealth
            import asyncio

            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=settings.playwright_headless,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--no-sandbox",
                        "--disable-gpu",
                        "--window-size=1440,900",
                    ],
                )
                ctx = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1440, "height": 900},
                    locale="en-US",
                    timezone_id="America/New_York",
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                )
                page = await ctx.new_page()
                await Stealth().apply_stealth_async(page)

                try:
                    await page.goto(index_url, wait_until="domcontentloaded", timeout=30_000)
                except Exception:
                    await asyncio.sleep(2)

                # Wait for JS rendering and scroll to trigger lazy loading
                await asyncio.sleep(4)
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(3)

                # Extract all anchor hrefs rendered in the DOM
                raw_hrefs: list[str] = await page.evaluate(
                    "() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)"
                )
                raw_attrs: list[str] = await page.evaluate(
                    "() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))"
                )

                # Build absolute URLs from relative paths too
                all_hrefs = set()
                base = f"https://{urlparse(index_url).netloc}"
                for href in raw_hrefs + [
                    (base + h if h and h.startswith("/") else h)
                    for h in raw_attrs
                    if h
                ]:
                    if href and href.startswith("http"):
                        all_hrefs.add(href)

                await browser.close()

                # Filter to listing URLs
                path_keywords = [
                    "business-opportunity", "business-auction", "business-for-sale",
                    "listing", "/BW", "for-sale", "sell-a-business",
                    "acquire.com/", "tworld.com/", "flippa.com/listing",
                ]
                listing_urls = []
                for href in all_hrefs:
                    href_lower = href.lower()
                    if domain in href and any(kw.lower() in href_lower for kw in path_keywords):
                        parts = urlparse(href).path.rstrip("/").split("/")
                        if len(parts) >= 3 and "#" not in href:
                            listing_urls.append(href)

                logger.info(
                    "[BrowserUse] playwright-stealth at %s → %d listing URLs (from %d total)",
                    index_url, len(listing_urls), len(all_hrefs),
                )
                if listing_urls:
                    return listing_urls

        except Exception as e:
            logger.error("[BrowserUse] playwright-stealth discover failed for %s: %s", index_url, e)

        # Final fallback: LLM agent
        return await self._discover_via_agent(index_url, link_pattern)

    async def _discover_via_agent(self, index_url: str, link_pattern: str) -> list[str]:
        """LLM agent fallback for JS-resistant pages."""
        llm = _get_llm()
        if not llm:
            return []
        task = (
            f"Go to {index_url}. Extract ALL business listing URLs matching: {link_pattern}. "
            f"Scroll to see all listings. Return ONLY JSON: {{\"urls\": [\"url1\", \"url2\", ...]}}"
        )
        try:
            from browser_use import Agent
            browser = _make_browser()
            agent = Agent(task=task, llm=llm, browser=browser, use_vision=False, max_failures=2)
            history = await agent.run(max_steps=15)
            await browser.stop()
            return self._parse_urls(history.final_result() or "")
        except Exception as e:
            logger.error("[BrowserUse] agent discover failed: %s", e)
            return []


    async def extract(
        self,
        url: str,
        source_slug: str,
        source_listing_id: str,
    ) -> Optional[NormalizedListing]:
        """
        Use browser-use Agent to extract listing details.
        The agent first visits the site homepage to establish Cloudflare cookies,
        then navigates to the listing page and extracts structured JSON.
        """
        if not self.available():
            return None

        llm = _get_llm()
        if not llm:
            return None

        from urllib.parse import urlparse
        homepage = f"https://{urlparse(url).netloc}/"

        task = (
            f"First navigate to {homepage} and wait 3 seconds for it to load. "
            f"Then navigate to {url} and extract all business listing details. "
            f"If you see an Access Denied or CAPTCHA page on the listing, do NOT search Google — "
            f"just return {{\"title\": null}} immediately. "
            f"If the listing loads, extract and return a JSON object with these fields (null if missing): "
            f"title, description (max 300 chars), asking_price_raw (exactly as shown e.g. '$1,200,000'), "
            f"revenue_raw, cash_flow_raw, cash_flow_type ('Cash Flow'|'SDE'|'EBITDA'|'Net Profit'|null), "
            f"employees (integer|null), year_established (4-digit integer|null), "
            f"city, state (2-letter US code|null), industry, "
            f"broker_name, broker_company, broker_phone, "
            f"is_franchise (boolean|null), seller_financing (boolean|null), reason_for_selling. "
            f"Return ONLY valid JSON, no markdown, no explanation."
        )

        try:
            from browser_use import Agent
            import asyncio

            browser = _make_browser()
            agent = Agent(
                task=task,
                llm=llm,
                browser=browser,
                use_vision=False,
                max_failures=1,
            )
            history = await agent.run(max_steps=12)
            await browser.stop()

            result_text = history.final_result() or ""
            data = self._parse_json(result_text)
            if not data or not data.get("title"):
                logger.warning("[BrowserUse] extract returned no title for %s", url)
                return None
            logger.info("[BrowserUse] Extracted: %s", data.get("title", "")[:60])
            return self._build_listing(data, url, source_slug, source_listing_id)

        except Exception as e:
            logger.error("[BrowserUse] extract failed for %s: %s", url, e)
            return None


    def _parse_urls(self, text: str) -> list[str]:
        """Parse JSON from agent output and return list of URLs."""
        if not text:
            return []
        data = self._parse_json(text)
        if isinstance(data, dict):
            urls = data.get("urls") or data.get("links") or []
            if isinstance(urls, list):
                return [u for u in urls if isinstance(u, str) and u.startswith("http")]
        return []

    def _parse_json(self, text: str) -> Optional[dict]:
        """Robustly extract JSON from agent output text."""
        if not text:
            return None
        # Strip markdown fences
        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        # Find JSON object
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            return None

    def _build_listing(
        self, data: dict, url: str, source_slug: str, listing_id: str
    ) -> Optional[NormalizedListing]:
        title = (data.get("title") or "").strip()
        if not title or len(title) < 5:
            return None

        return NormalizedListing(
            source_slug=source_slug,
            source_listing_id=listing_id,
            listing_url=url,
            title=title,
            description=clean_text(data.get("description")),
            asking_price_raw=data.get("asking_price_raw"),
            asking_price=parse_currency(data.get("asking_price_raw")),
            revenue_raw=data.get("revenue_raw"),
            revenue=parse_currency(data.get("revenue_raw")),
            cash_flow_raw=data.get("cash_flow_raw"),
            cash_flow=parse_currency(data.get("cash_flow_raw")),
            cash_flow_type=data.get("cash_flow_type"),
            employees=_safe_int(data.get("employees")),
            year_established=_safe_int(data.get("year_established")),
            industry=normalize_industry(data.get("industry")),
            city=data.get("city"),
            state=normalize_state(data.get("state")),
            broker_name=data.get("broker_name"),
            broker_company=data.get("broker_company"),
            broker_phone=data.get("broker_phone"),
            is_franchise=data.get("is_franchise"),
            seller_financing=data.get("seller_financing"),
            reason_for_selling=data.get("reason_for_selling"),
            extraction_tier="tier2",
            extraction_confidence=0.80,
        )


def _safe_int(v) -> Optional[int]:
    try:
        return int(v) if v is not None else None
    except (ValueError, TypeError):
        return None
