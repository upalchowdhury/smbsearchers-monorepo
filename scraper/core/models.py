"""NormalizedListing — the single schema all adapters must produce."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NormalizedListing:
    # Required identifiers
    source_slug: str          # 'bizbuysell', 'bizquest', etc.
    source_listing_id: str    # site's own ID / URL slug
    listing_url: str

    # Core fields
    title: str = ""
    description: Optional[str] = None
    summary: Optional[str] = None

    # Financials (stored as cents / integers)
    asking_price: Optional[int] = None   # in cents
    revenue: Optional[int] = None
    cash_flow: Optional[int] = None
    ebitda: Optional[int] = None
    inventory_value: Optional[int] = None
    ffe_value: Optional[int] = None
    real_estate_value: Optional[int] = None

    # Raw strings (preserve original before parsing)
    asking_price_raw: Optional[str] = None
    revenue_raw: Optional[str] = None
    cash_flow_raw: Optional[str] = None
    cash_flow_type: Optional[str] = None   # 'Cash Flow', 'SDE', 'EBITDA', 'Net Profit'

    # Business details
    employees: Optional[int] = None
    year_established: Optional[int] = None
    industry: Optional[str] = None
    sub_industry: Optional[str] = None
    business_type: Optional[str] = None

    # Location
    city: Optional[str] = None
    state: Optional[str] = None   # 2-letter code
    country: str = "US"
    location_is_undisclosed: bool = False

    # Flags
    is_franchise: Optional[bool] = None
    seller_financing: Optional[bool] = None
    is_absentee_owner: Optional[bool] = None
    is_home_based: Optional[bool] = None
    has_real_estate: Optional[bool] = None

    # Broker info
    broker_name: Optional[str] = None
    broker_company: Optional[str] = None
    broker_phone: Optional[str] = None
    broker_email: Optional[str] = None

    # Images
    images: list[str] = field(default_factory=list)

    # Extraction metadata
    extraction_tier: str = "tier1"          # 'tier1', 'tier2', 'tier3'
    extraction_confidence: float = 1.0
    parser_version: str = "v1"
    raw_html: Optional[str] = None
    reason_for_selling: Optional[str] = None

    def is_valid(self) -> bool:
        """Minimum viable listing check — reject placeholders and failures."""
        if not self.title or not self.listing_url:
            return False
        t = self.title.strip()
        # Reject placeholder/failed/blocked titles
        if t.startswith("[") or t.startswith("("):
            return False
        # Reject pure-numeric IDs used as title fallbacks
        if t.isdigit():
            return False
        # Reject extraction_tier = 'failed'
        if self.extraction_tier == "failed":
            return False
        return len(t) >= 8

    def to_dict(self) -> dict:
        import dataclasses
        return dataclasses.asdict(self)
