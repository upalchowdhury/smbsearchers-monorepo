"""Currency, state, and industry normalizers."""
from __future__ import annotations
import re
import unicodedata
from typing import Optional


# ─── Currency ──────────────────────────────────────────────────────────────────

_MULTIPLIERS = {
    "b": 1_000_000_000,
    "billion": 1_000_000_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "k": 1_000,
    "thousand": 1_000,
}


def parse_currency(raw: Optional[str]) -> Optional[int]:
    """
    Parse a human-readable money string into cents.

    Examples:
        "$1.2M" → 120000000
        "$250,000" → 25000000000... wait, *cents*:
        "$1.2M" → 120_000_000  (1.2M dollars = 120M cents)
        "$250,000" → 25_000_000 cents
        "Not Disclosed" → None
    """
    if not raw:
        return None

    raw = raw.strip()
    # Remove currency symbols and common no-data strings
    lower = raw.lower()
    if any(kw in lower for kw in ("not disclosed", "undisclosed", "n/a", "contact",
                                   "call", "inquire", "negotiable", "tbd", "--", "—")):
        return None

    # Normalize unicode
    raw = unicodedata.normalize("NFKD", raw)
    # Strip non-numeric prefix/suffix except digits, dots, commas, and letters
    cleaned = re.sub(r"[$€£¥₹,\s]", "", raw).lower()

    # Check for multiplier suffix
    multiplier = 1
    for suffix, mult in sorted(_MULTIPLIERS.items(), key=lambda x: -len(x[0])):
        if cleaned.endswith(suffix):
            multiplier = mult
            cleaned = cleaned[: -len(suffix)]
            break

    try:
        value_dollars = float(cleaned) * multiplier
        return int(value_dollars * 100)  # store as cents
    except (ValueError, TypeError):
        return None


def format_currency(cents: Optional[int]) -> Optional[str]:
    """Convert cents back to a human-readable string."""
    if cents is None:
        return None
    dollars = cents / 100
    if dollars >= 1_000_000_000:
        return f"${dollars / 1_000_000_000:.1f}B"
    if dollars >= 1_000_000:
        return f"${dollars / 1_000_000:.1f}M"
    if dollars >= 1_000:
        return f"${dollars / 1_000:.0f}K"
    return f"${dollars:,.0f}"


# ─── States ────────────────────────────────────────────────────────────────────

_STATE_MAP: dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}

# Include both lower-case full names AND uppercase codes
_STATE_CODES: set[str] = set(_STATE_MAP.values())


def normalize_state(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    if raw.upper() in _STATE_CODES:
        return raw.upper()
    return _STATE_MAP.get(raw.lower().strip())


# ─── Industry ──────────────────────────────────────────────────────────────────

_INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "Technology & SaaS": ["saas", "software", "tech", "app", "digital", "website", "ecommerce", "e-commerce", "ai", "fintech"],
    "Restaurants & Food": ["restaurant", "food", "bakery", "cafe", "bar", "catering", "pizza", "deli", "brewery"],
    "Retail": ["retail", "store", "shop", "boutique", "clothing", "apparel", "gift"],
    "Healthcare": ["medical", "dental", "pharmacy", "healthcare", "health", "clinic", "therapy", "care"],
    "Home Services": ["plumbing", "hvac", "landscaping", "cleaning", "roofing", "construction", "remodeling", "handyman", "pest"],
    "B2B Services": ["staffing", "accounting", "logistics", "distribution", "manufacturing", "wholesale", "consulting", "b2b"],
    "Education": ["education", "school", "tutoring", "daycare", "childcare", "learning"],
    "Automotive": ["auto", "car", "vehicle", "mechanic", "detailing", "repair"],
    "Fitness & Wellness": ["gym", "fitness", "yoga", "salon", "spa", "beauty", "wellness"],
    "Franchise": ["franchise"],
}


def normalize_industry(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    lower = raw.lower()
    for industry, keywords in _INDUSTRY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return industry
    # Return title-cased original if no match
    return raw.strip().title()[:100]


def clean_text(text: Optional[str], max_len: int = 5000) -> Optional[str]:
    if not text:
        return None
    text = text.strip()
    # Collapse whitespace
    text = re.sub(r"\s{2,}", " ", text)
    return text[:max_len] if text else None
