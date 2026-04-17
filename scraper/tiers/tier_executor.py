"""TierExecutor — fallback chain: Tier 1 → Tier 2 → Tier 3."""
from __future__ import annotations
import logging
from typing import Callable, Optional

from core.models import NormalizedListing
from tiers.tier2_browser_use import BrowserUseService
from tiers.tier3_tinyfish import TinyFishService

logger = logging.getLogger(__name__)

_t2 = BrowserUseService()
_t3 = TinyFishService()


def _is_sparse(listing: Optional[NormalizedListing]) -> bool:
    if listing is None or not listing.is_valid():
        return True
    has_price = listing.asking_price is not None or bool(listing.asking_price_raw)
    has_description = bool(listing.description and len(listing.description) > 50)
    return not has_price and not has_description


async def execute_with_fallback(
    *,
    html: str,
    page_text: str,
    url: str,
    source_slug: str,
    source_listing_id: str,
    tier1_fn: Callable[[str, str, str], Optional[NormalizedListing]],
    force_tier: Optional[str] = None,
    use_tinyfish_stealth: bool = False,
) -> NormalizedListing:
    if force_tier == "tier3" or (use_tinyfish_stealth and force_tier is None):
        result = await _t3.extract(url, source_slug, source_listing_id, use_stealth=True)
        if result and result.is_valid():
            return result
        return _placeholder(url, source_slug, source_listing_id)

    if force_tier in (None, "tier1"):
        try:
            result = tier1_fn(html, url, source_listing_id)
            if result and not _is_sparse(result):
                logger.debug("[%s] Tier 1 success: %s", source_slug, url)
                return result
            logger.info("[%s] Tier 1 sparse, escalating: %s", source_slug, url)
        except Exception as e:
            logger.warning("[%s] Tier 1 exception: %s — %s", source_slug, url, e)

    if force_tier in (None, "tier1", "tier2"):
        if _t2.available():
            try:
                result = await _t2.extract(url, source_slug, source_listing_id)
                if result and result.is_valid():
                    logger.info("[%s] Tier 2 success: %s", source_slug, url)
                    return result
            except Exception as e:
                logger.warning("[%s] Tier 2 failed: %s — %s", source_slug, url, e)

    if _t3.available():
        try:
            result = await _t3.extract(url, source_slug, source_listing_id, use_stealth=True)
            if result and result.is_valid():
                logger.info("[%s] Tier 3 success: %s", source_slug, url)
                return result
        except Exception as e:
            logger.warning("[%s] Tier 3 failed: %s — %s", source_slug, url, e)

    logger.error("[%s] All tiers failed: %s", source_slug, url)
    return _placeholder(url, source_slug, source_listing_id)


def _placeholder(url: str, source_slug: str, listing_id: str) -> NormalizedListing:
    return NormalizedListing(
        source_slug=source_slug, source_listing_id=listing_id, listing_url=url,
        title=f"[Pending] {listing_id}", extraction_tier="failed", extraction_confidence=0.0,
    )
