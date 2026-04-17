"""Tier 3: TinyFish cloud browser via SSE API.

TinyFish is used as PRIMARY for bot-protected sites (BizBuySell, BizQuest,
Acquire, TransWorld, Flippa) and as FALLBACK for others.

It handles both:
  - URL discovery (extract all listing links from a search results page)
  - Detail extraction (extract all fields from a single listing page)
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional

import httpx

from core.config import settings
from core.models import NormalizedListing
from core.normalizer import parse_currency, normalize_state, normalize_industry, clean_text

logger = logging.getLogger(__name__)

TINYFISH_ENDPOINT = "https://agent.tinyfish.ai/v1/automation/run-sse"

# ─── Extraction goals ──────────────────────────────────────────────────────────

_DETAIL_GOAL = (
    "Extract all business-for-sale listing details from this page. "
    "Return a JSON object with these fields (use null for missing): "
    "title (string, the full listing title), "
    "description (string, the full business description, max 800 chars), "
    "asking_price_raw (string exactly as shown e.g. '$1,200,000' or '$1.2M'), "
    "revenue_raw (string exactly as shown), "
    "cash_flow_raw (string exactly as shown), "
    "cash_flow_type (one of: 'Cash Flow', 'SDE', 'EBITDA', 'Net Profit', or null), "
    "employees (integer or null), "
    "year_established (4-digit integer or null), "
    "city (string or null), "
    "state (2-letter US state code e.g. 'CA', or null), "
    "industry (string, the business category/industry), "
    "broker_name (string or null), "
    "broker_company (string or null), "
    "broker_phone (string or null), "
    "is_franchise (boolean or null), "
    "seller_financing (boolean or null), "
    "reason_for_selling (string or null). "
    "Return ONLY valid JSON, no markdown."
)


def _discovery_goal(site_name: str, link_pattern: str) -> str:
    return (
        f"Extract all business listing links from this {site_name} search results page. "
        f"Look for links that match the pattern: {link_pattern}. "
        "Return a JSON object: {\"urls\": [\"url1\", \"url2\", ...]} "
        "Include only individual listing detail page URLs, not pagination or category links. "
        "Return full absolute URLs. If there are no listings, return {\"urls\": []}. "
        "Return ONLY valid JSON, no markdown."
    )


# ─── TinyFish Service ──────────────────────────────────────────────────────────

class TinyFishService:
    """
    Wrapper around the TinyFish SSE API.
    Use stealth + US proxy for bot-protected sites (BizBuySell, BizQuest, etc).
    """

    def available(self) -> bool:
        return settings.has_tinyfish

    async def _call(
        self,
        url: str,
        goal: str,
        use_stealth: bool = True,
        use_proxy: bool = True,
        timeout: int = 180,
    ) -> Optional[dict | list]:
        """
        Make a TinyFish SSE call. Returns the parsed resultJson on COMPLETED,
        or None on failure.
        """
        if not self.available():
            logger.warning("[TinyFish] No API key configured")
            return None

        payload: dict = {"url": url, "goal": goal}
        if use_stealth:
            payload["browser_profile"] = "stealth"
        if use_proxy:
            payload["proxy_config"] = {"enabled": True, "country_code": "US"}

        headers = {
            "X-API-Key": settings.tinyfish_api_key,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", TINYFISH_ENDPOINT, json=payload, headers=headers
                ) as resp:
                    resp.raise_for_status()
                    buffer = ""
                    async for chunk in resp.aiter_text():
                        buffer += chunk
                        lines = buffer.split("\n")
                        buffer = lines.pop()
                        for line in lines:
                            line = line.strip()
                            if not line.startswith("data: "):
                                continue
                            try:
                                event = json.loads(line[6:])
                            except json.JSONDecodeError:
                                continue

                            etype = event.get("type", "")
                            if etype == "PROGRESS":
                                logger.debug("[TinyFish] Progress: %s", event.get("message", ""))
                            elif etype == "COMPLETE":
                                status = event.get("status")
                                if status == "COMPLETED":
                                    raw = event.get("resultJson") or event.get("result")
                                    if isinstance(raw, str):
                                        # Strip markdown code fences if present
                                        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
                                        raw = re.sub(r"\s*```$", "", raw)
                                        try:
                                            return json.loads(raw)
                                        except json.JSONDecodeError:
                                            logger.error("[TinyFish] Bad JSON: %s", raw[:200])
                                            return None
                                    return raw
                                else:
                                    logger.warning("[TinyFish] COMPLETE with status=%s for %s", status, url)
                                    return None

        except httpx.HTTPStatusError as e:
            logger.error("[TinyFish] HTTP %s for %s", e.response.status_code, url)
        except Exception as e:
            logger.error("[TinyFish] Error for %s: %s", url, e)
        return None

    async def discover_urls(
        self,
        index_url: str,
        site_name: str,
        link_pattern: str,
        use_stealth: bool = True,
        use_proxy: bool = True,
    ) -> list[str]:
        """
        Use TinyFish to extract all listing URLs from a search results page.
        Returns a list of absolute URLs.
        """
        goal = _discovery_goal(site_name, link_pattern)
        logger.info("[TinyFish] Discovering URLs from %s", index_url)
        result = await self._call(index_url, goal, use_stealth=use_stealth, use_proxy=use_proxy)

        if isinstance(result, dict):
            urls = result.get("urls") or result.get("links") or result.get("listings") or []
            if isinstance(urls, list):
                return [u for u in urls if isinstance(u, str) and u.startswith("http")]

        logger.warning("[TinyFish] Discovery returned unexpected format for %s: %s", index_url, str(result)[:200])
        return []

    async def extract(
        self,
        url: str,
        source_slug: str,
        source_listing_id: str,
        use_stealth: bool = True,
        use_proxy: bool = True,
    ) -> Optional[NormalizedListing]:
        """
        Use TinyFish to extract all fields from a single listing detail page.
        Returns a NormalizedListing or None on failure.
        """
        logger.info("[TinyFish] Extracting: %s", url)
        result = await self._call(url, _DETAIL_GOAL, use_stealth=use_stealth, use_proxy=use_proxy)

        if not isinstance(result, dict):
            logger.warning("[TinyFish] No result for %s", url)
            return None

        return self._parse(result, url, source_slug, source_listing_id)

    def _parse(self, data: dict, url: str, source_slug: str, listing_id: str) -> Optional[NormalizedListing]:
        title = (data.get("title") or "").strip()
        if not title or len(title) < 3:
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
            employees=_int_or_none(data.get("employees")),
            year_established=_int_or_none(data.get("year_established")),
            industry=normalize_industry(data.get("industry")),
            city=data.get("city"),
            state=normalize_state(data.get("state")),
            broker_name=data.get("broker_name"),
            broker_company=data.get("broker_company"),
            broker_phone=data.get("broker_phone"),
            is_franchise=_bool_or_none(data.get("is_franchise")),
            seller_financing=_bool_or_none(data.get("seller_financing")),
            reason_for_selling=data.get("reason_for_selling"),
            extraction_tier="tier3",
            extraction_confidence=0.85,
        )


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _int_or_none(v) -> Optional[int]:
    try:
        return int(v) if v is not None else None
    except (ValueError, TypeError):
        return None


def _bool_or_none(v) -> Optional[bool]:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "yes", "1")
    return bool(v)
