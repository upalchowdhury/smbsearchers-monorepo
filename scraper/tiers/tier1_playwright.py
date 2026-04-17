"""Tier 1: Deterministic Playwright + BeautifulSoup extraction."""
from __future__ import annotations
import json as _json
import logging
import re
from typing import Optional
from bs4 import BeautifulSoup, Tag

from core.models import NormalizedListing
from core.normalizer import parse_currency, normalize_state, normalize_industry, clean_text

logger = logging.getLogger(__name__)


def soup_text(el: Optional[Tag], default: str = "") -> str:
    if el is None:
        return default
    return el.get_text(separator=" ", strip=True)


def first_text(soup: BeautifulSoup, *selectors: str) -> str:
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(separator=" ", strip=True)
            if text:
                return text
    return ""


def parse_fact_sheet(soup: BeautifulSoup) -> dict[str, str]:
    facts: dict[str, str] = {}
    for dt in soup.find_all("dt"):
        key = dt.get_text(strip=True).lower().rstrip(":")
        dd = dt.find_next_sibling("dd")
        if dd:
            facts[key] = dd.get_text(separator=" ", strip=True)
    for tr in soup.find_all("tr"):
        cells = tr.find_all(["th", "td"])
        if len(cells) == 2:
            key = cells[0].get_text(strip=True).lower().rstrip(":")
            facts[key] = cells[1].get_text(separator=" ", strip=True)
    return facts


def extract_price_from_facts(facts: dict[str, str], *keys: str) -> Optional[str]:
    for key in keys:
        for fact_key, value in facts.items():
            if key in fact_key and value and value not in ("--", "—", "N/A", ""):
                return value
    return None


def bizbuysell_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    soup = BeautifulSoup(html, "lxml")
    title = first_text(soup, "h1")
    if not title or len(title) < 3:
        return None
    facts = parse_fact_sheet(soup)
    description = first_text(soup, "#business-description", ".businessDescription",
        ".listing-description", "[class*='description']", "article")
    location_text = first_text(soup, ".listingLocation", ".location", "[class*='location']")
    city, state = _split_location(location_text)
    listing = NormalizedListing(
        source_slug="bizbuysell", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price"),
        revenue_raw=extract_price_from_facts(facts, "gross revenue", "revenue"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(first_text(soup, ".breadcrumb a:last-child", "[class*='category']")),
        broker_name=first_text(soup, "[class*='broker-name']", "[class*='contact-name']"),
        broker_company=first_text(soup, "[class*='broker-company']"),
        broker_phone=first_text(soup, "[class*='broker-phone']", "[class*='phone']"),
        is_franchise=_str_bool(facts.get("franchise")),
        seller_financing=_str_bool(facts.get("seller financing")),
        is_home_based=_str_bool(facts.get("home-based") or facts.get("home based")),
        has_real_estate=_str_bool(facts.get("real estate")),
        year_established=_year(facts.get("year established") or facts.get("established")),
        employees=_emp(facts.get("employees")),
        reason_for_selling=facts.get("reason for selling"),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def bizquest_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    soup = BeautifulSoup(html, "lxml")
    title = first_text(soup, "h1")
    if not title or len(title) < 3:
        return None
    facts = parse_fact_sheet(soup)
    description = first_text(soup, ".business-description", "[class*='description']", "article")
    location_text = first_text(soup, "[class*='location']")
    city, state = _split_location(location_text)
    listing = NormalizedListing(
        source_slug="bizquest", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "price"),
        revenue_raw=extract_price_from_facts(facts, "gross revenue", "revenue"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(first_text(soup, "[class*='category']", "[class*='industry']", ".breadcrumb a")),
        broker_company=first_text(soup, "[class*='broker']", "[class*='company']"),
        year_established=_year(facts.get("established") or facts.get("year established")),
        employees=_emp(facts.get("employees")),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def transworld_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    soup = BeautifulSoup(html, "lxml")
    title = first_text(soup, "h1")
    if not title or len(title) < 3:
        return None
    facts = parse_fact_sheet(soup)
    description = first_text(soup, ".listing-description", ".description", "article")
    location_text = first_text(soup, "[class*='location']", ".location")
    city, state = _split_location(location_text)
    listing = NormalizedListing(
        source_slug="transworld", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "price", "listed price"),
        revenue_raw=extract_price_from_facts(facts, "gross revenue", "revenue"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(first_text(soup, "[class*='category']", "[class*='industry']")),
        broker_company="TransWorld Business Advisors",
        year_established=_year(facts.get("established") or facts.get("year established")),
        employees=_emp(facts.get("employees")),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def quietlight_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    """
    QuietLight structure (verified against live pages):
    - Listing title: first <h3> on the page (NOT h1 — that's the broker name)
    - Price: elements with class 'inform_price' or 'single_business_price'
    - Financial data: <li> items or dt/dd pairs in a .inform-listing-details section
    """
    soup = BeautifulSoup(html, "lxml")

    # Title: first h3 that isn't "Meet Your Advisor" or structural nav
    title = ""
    for h3 in soup.find_all("h3"):
        text = h3.get_text(strip=True)
        if text and len(text) >= 5 and "advisor" not in text.lower() and "selling" not in text.lower():
            title = text
            break
    # Also try .listing-title as fallback
    if not title:
        title = first_text(soup, ".listing-title", ".listing-heading", "[class*='listing-title']")
    if not title or len(title) < 3:
        return None

    facts = parse_fact_sheet(soup)

    # Price: QuietLight has multiple elements with class 'inform_price'.
    # Find the one that contains 'Asking Price:' text and extract the $ amount from it.
    ask_price_raw = None
    for el in soup.find_all(class_="inform_price"):
        raw_text = el.get_text(separator=" ", strip=True)
        if "asking price" in raw_text.lower() or "asking:" in raw_text.lower():
            # Format: "Asking Price: $12,400,000 Reading Time: ..."
            m = re.search(r"\$[\d,]+(?:\.\d+)?[MKBmkb]?", raw_text)
            if m:
                ask_price_raw = m.group()
                break
    if not ask_price_raw:
        ask_price_raw = extract_price_from_facts(facts, "asking price", "price")


    revenue_raw = (
        first_text(soup, "[class*='revenue']", "[class*='Revenue']")
        or extract_price_from_facts(facts, "revenue", "annual revenue", "ttm revenue", "gross revenue")
    )
    cf_raw = (
        first_text(soup, "[class*='profit']", "[class*='cash-flow']", "[class*='sde']")
        or extract_price_from_facts(facts, "net profit", "cash flow", "sde", "ebitda")
    )

    description = first_text(soup, ".listing-description", "[class*='description']", ".about", "article")

    listing = NormalizedListing(
        source_slug="quietlight", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=ask_price_raw,
        revenue_raw=revenue_raw,
        cash_flow_raw=cf_raw,
        cash_flow_type=_detect_cash_flow_type(facts),
        business_type="Digital / Online",
        industry=normalize_industry(first_text(soup, "[class*='category']", "[class*='type']")),
        broker_name=first_text(soup, "h1", "[class*='advisor-name']"),  # h1 IS the broker name
        broker_company="Quiet Light Brokerage",
        year_established=_year(facts.get("year established") or facts.get("founded")),
        employees=_emp(facts.get("employees") or facts.get("team size")),
        has_real_estate=_str_bool(facts.get("real estate")),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def acquire_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    soup = BeautifulSoup(html, "lxml")
    next_data_tag = soup.find("script", id="__NEXT_DATA__")
    if next_data_tag:
        try:
            next_data = _json.loads(next_data_tag.string or "")
            props = next_data.get("props", {}).get("pageProps", {})
            l = props.get("listing") or props.get("startup") or props
            title = l.get("headline") or l.get("title") or l.get("name") or ""
            if title and len(title) >= 3:
                return NormalizedListing(
                    source_slug="acquire", source_listing_id=listing_id, listing_url=url,
                    title=title.strip(), description=clean_text(l.get("description") or l.get("about")),
                    asking_price_raw=str(l.get("askingPrice") or l.get("price") or ""),
                    asking_price=parse_currency(str(l.get("askingPrice") or "")),
                    revenue_raw=str(l.get("ttmRevenue") or l.get("arr") or l.get("revenue") or ""),
                    revenue=parse_currency(str(l.get("ttmRevenue") or l.get("arr") or "")),
                    cash_flow_raw=str(l.get("ttmProfit") or l.get("profit") or ""),
                    cash_flow=parse_currency(str(l.get("ttmProfit") or l.get("profit") or "")),
                    cash_flow_type="Net Profit",
                    industry=normalize_industry(l.get("industry") or l.get("category") or "Technology & SaaS"),
                    business_type="Digital / SaaS",
                    extraction_tier="tier1", extraction_confidence=0.95,
                )
        except Exception as e:
            logger.warning("[acquire] __NEXT_DATA__ parse failed: %s", e)
    title = first_text(soup, "h1")
    if not title or len(title) < 3:
        return None
    return NormalizedListing(
        source_slug="acquire", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(first_text(soup, "[class*='description']", "[class*='about']")),
        industry="Technology & SaaS", business_type="Digital / SaaS",
        extraction_tier="tier1", extraction_confidence=0.5,
    )


def flippa_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    """
    Flippa listing page — React SPA, but key data is often in JSON-LD or meta tags.
    Flippa structure:
      - Title: h1 with class containing 'listing' or 'title'
      - Price: elements with 'asking' or 'price' in class/text
      - Revenue/Profit: dt/dd or labeled stat blocks
    """
    soup = BeautifulSoup(html, "lxml")

    # Try JSON-LD first (Flippa embeds structured data)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = _json.loads(script.string or "")
            if isinstance(data, list):
                data = data[0]
            name = data.get("name") or data.get("title") or ""
            if name and len(name) >= 3:
                price_raw = str(data.get("offers", {}).get("price") or data.get("price") or "")
                return NormalizedListing(
                    source_slug="flippa", source_listing_id=listing_id, listing_url=url,
                    title=name.strip(),
                    description=clean_text(data.get("description")),
                    asking_price_raw=price_raw or None,
                    asking_price=parse_currency(price_raw),
                    industry=normalize_industry(data.get("category") or "Digital / Online"),
                    business_type="Digital / Online",
                    extraction_tier="tier1", extraction_confidence=0.80,
                )
        except Exception:
            pass

    title = first_text(soup, "h1", "[class*='listing-title']", "[class*='title']")
    if not title or len(title) < 3:
        return None

    facts = parse_fact_sheet(soup)
    description = first_text(soup,
        "[class*='description']", "[class*='about']",
        "[class*='listing-description']", "article",
    )
    listing = NormalizedListing(
        source_slug="flippa", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "buy it now", "price"),
        revenue_raw=extract_price_from_facts(facts, "revenue", "annual revenue", "monthly revenue"),
        cash_flow_raw=extract_price_from_facts(facts, "profit", "net profit", "cash flow", "sde"),
        cash_flow_type=_detect_cash_flow_type(facts),
        business_type="Digital / Online",
        industry=normalize_industry(
            first_text(soup, "[class*='category']", "[class*='type']", "[class*='niche']")
        ),
        year_established=_year(facts.get("year established") or facts.get("founded") or facts.get("age")),
        employees=_emp(facts.get("employees") or facts.get("team size")),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def websiteclosers_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    """
    WebsiteClosers listing page — WordPress-based broker site.
    Structure:
      - Title: h1 (full listing title)
      - Price/Revenue/CF: labeled sections, often in a sidebar or fact table
      - Description: main content div
      - Broker: contact section
    """
    soup = BeautifulSoup(html, "lxml")

    title = first_text(soup, "h1", ".listing-title", "[class*='listing-title']")
    if not title or len(title) < 3:
        return None

    facts = parse_fact_sheet(soup)
    description = first_text(soup,
        ".listing-description", "[class*='description']",
        ".entry-content", "article", ".business-overview",
    )
    location_text = first_text(soup, "[class*='location']", ".location", "[class*='state']")
    city, state = _split_location(location_text)

    listing = NormalizedListing(
        source_slug="websiteclosers", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "price", "list price"),
        revenue_raw=extract_price_from_facts(facts, "gross revenue", "revenue", "annual revenue", "ttm revenue"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda", "net profit", "seller discretionary"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(
            first_text(soup, "[class*='category']", "[class*='industry']", ".business-type")
        ),
        business_type="Digital / Online",
        broker_name=first_text(soup, "[class*='broker-name']", "[class*='contact-name']", ".broker-name"),
        broker_company="WebsiteClosers",
        broker_phone=first_text(soup, "[class*='phone']", "[class*='broker-phone']"),
        year_established=_year(facts.get("year established") or facts.get("established") or facts.get("founded")),
        employees=_emp(facts.get("employees") or facts.get("team size")),
        seller_financing=_str_bool(facts.get("seller financing") or facts.get("seller financed")),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def moxie_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    """
    Moxie Brokerage Group listing page — boutique broker, custom CMS.
    Typically has a clean layout with labeled key metrics.
    """
    soup = BeautifulSoup(html, "lxml")

    title = first_text(soup, "h1", "h2", "[class*='listing-title']", "[class*='title']")
    if not title or len(title) < 3:
        return None

    facts = parse_fact_sheet(soup)
    description = first_text(soup,
        "[class*='description']", "[class*='overview']",
        ".listing-body", "article", ".content",
    )
    location_text = first_text(soup, "[class*='location']", "[class*='city']", "[class*='state']")
    city, state = _split_location(location_text)

    listing = NormalizedListing(
        source_slug="moxie", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "price", "asking"),
        revenue_raw=extract_price_from_facts(facts, "revenue", "gross revenue", "annual revenue", "sales"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda", "net profit"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(
            first_text(soup, "[class*='category']", "[class*='industry']", "[class*='type']")
        ),
        broker_name=first_text(soup, "[class*='broker']", "[class*='agent']", "[class*='contact-name']"),
        broker_company="Moxie Brokerage Group",
        year_established=_year(facts.get("established") or facts.get("year established") or facts.get("founded")),
        employees=_emp(facts.get("employees") or facts.get("staff") or facts.get("team")),
        seller_financing=_str_bool(facts.get("seller financing")),
        reason_for_selling=facts.get("reason for selling") or facts.get("reason for sale"),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


def sunbelt_t1(html: str, url: str, listing_id: str) -> Optional[NormalizedListing]:
    """
    Sunbelt Network listing page — large brokerage network with a structured layout.
    Structure:
      - Title: h1 or .listing-title
      - Key stats: dl/dt/dd or table rows with labels
      - Location shown in title or separate location field
      - Broker: contact card at bottom of page
    """
    soup = BeautifulSoup(html, "lxml")

    title = first_text(soup, "h1", ".listing-title", "[class*='listing-title']", "[class*='business-title']")
    if not title or len(title) < 3:
        return None

    facts = parse_fact_sheet(soup)
    description = first_text(soup,
        "[class*='description']", "[class*='overview']",
        ".listing-description", ".business-description", "article",
    )
    location_text = first_text(soup,
        "[class*='location']", "[class*='city-state']",
        ".location", "[class*='address']",
    )
    city, state = _split_location(location_text)

    listing = NormalizedListing(
        source_slug="sunbelt", source_listing_id=listing_id, listing_url=url,
        title=title, description=clean_text(description),
        asking_price_raw=extract_price_from_facts(facts, "asking price", "list price", "price"),
        revenue_raw=extract_price_from_facts(facts, "gross revenue", "revenue", "annual revenue", "annual sales"),
        cash_flow_raw=extract_price_from_facts(facts, "cash flow", "sde", "ebitda", "seller discretionary"),
        cash_flow_type=_detect_cash_flow_type(facts),
        city=city, state=normalize_state(state),
        industry=normalize_industry(
            first_text(soup, "[class*='category']", "[class*='industry']", "[class*='type']", ".breadcrumb a")
        ),
        broker_name=first_text(soup, "[class*='broker-name']", "[class*='agent-name']", "[class*='contact-name']"),
        broker_company=first_text(soup, "[class*='broker-company']", "[class*='office']") or "Sunbelt Network",
        broker_phone=first_text(soup, "[class*='phone']", "[class*='broker-phone']"),
        year_established=_year(facts.get("year established") or facts.get("established") or facts.get("founded")),
        employees=_emp(facts.get("employees") or facts.get("number of employees")),
        is_franchise=_str_bool(facts.get("franchise")),
        seller_financing=_str_bool(facts.get("seller financing") or facts.get("owner financing")),
        has_real_estate=_str_bool(facts.get("real estate") or facts.get("real property")),
        reason_for_selling=facts.get("reason for selling") or facts.get("reason for sale"),
        extraction_tier="tier1",
    )
    listing.asking_price = parse_currency(listing.asking_price_raw)
    listing.revenue = parse_currency(listing.revenue_raw)
    listing.cash_flow = parse_currency(listing.cash_flow_raw)
    return listing


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _split_location(text: str):
    if not text:
        return None, None
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if len(parts) >= 2:
        return parts[0], parts[-1]
    return None, None


def _str_bool(v: Optional[str]) -> Optional[bool]:
    if v is None:
        return None
    return v.lower() in ("yes", "true", "1", "included", "available")


def _year(v: Optional[str]) -> Optional[int]:
    if not v:
        return None
    m = re.search(r"\b(19|20)\d{2}\b", v)
    return int(m.group()) if m else None


def _emp(v: Optional[str]) -> Optional[int]:
    if not v:
        return None
    m = re.search(r"\d+", v.replace(",", ""))
    return int(m.group()) if m else None


def _detect_cash_flow_type(facts: dict[str, str]) -> Optional[str]:
    for key in facts:
        if "ebitda" in key:
            return "EBITDA"
        if "sde" in key:
            return "SDE"
        if "cash flow" in key:
            return "Cash Flow"
        if "net profit" in key or "net income" in key:
            return "Net Profit"
    return None
