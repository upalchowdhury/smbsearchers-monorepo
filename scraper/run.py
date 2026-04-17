#!/usr/bin/env python3
"""
DealFlow Scraper CLI

Usage:
    python run.py --source bizbuysell --pages 5 --dry-run
    python run.py --source all
    python run.py --source flippa --tier tier3
    python run.py --source quietlight transworld --pages 2
"""
import asyncio
import importlib
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

# Ensure the scraper directory itself is importable as a flat namespace
_scraper_dir = Path(__file__).parent
if str(_scraper_dir) not in sys.path:
    sys.path.insert(0, str(_scraper_dir))

from core.browser import BrowserService, get_browser, shutdown_browser
from core.db import get_pool, close_pool, ensure_source, create_scrape_run, finish_scrape_run, upsert_listing
from core.models import NormalizedListing

console = Console()
logger = logging.getLogger(__name__)

ADAPTERS = {
    "bizbuysell": "adapters.bizbuysell",
    "bizquest": "adapters.bizquest",
    "acquire": "adapters.acquire",
    "transworld": "adapters.transworld",
    "quietlight": "adapters.quietlight",
    "flippa": "adapters.flippa",
    "websiteclosers": "adapters.websiteclosers",
    "moxie": "adapters.moxie",
    "sunbelt": "adapters.sunbelt",
}


@dataclass
class RunStats:
    source: str
    found: int = 0
    new: int = 0
    updated: int = 0
    errors: int = 0
    duration_s: float = 0.0


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
    )


async def run_source(
    source_slug: str,
    *,
    max_pages: int = 50,
    dry_run: bool = False,
    force_tier: Optional[str] = None,
) -> RunStats:
    if source_slug not in ADAPTERS:
        raise ValueError(f"Unknown source: {source_slug}")

    adapter = importlib.import_module(ADAPTERS[source_slug])
    stats = RunStats(source=source_slug)
    start = time.monotonic()

    browser: Optional[BrowserService] = None
    pool = None
    source_id: Optional[str] = None
    run_id: Optional[str] = None

    try:
        browser = await get_browser()

        if not dry_run:
            pool = await get_pool()
            async with pool.acquire() as conn:
                source_id = await ensure_source(conn, source_slug)
                run_id = await create_scrape_run(conn, source_id)

        console.print(f"\n[bold cyan]▶ Scraping {source_slug}[/] (max_pages={max_pages}, dry_run={dry_run})")

        # Discover listing URLs
        listing_urls: list[str] = []
        async for url in adapter.discover_urls(browser, max_pages=max_pages):
            listing_urls.append(url)

        console.print(f"  [green]Discovered {len(listing_urls)} URLs[/]")
        stats.found = len(listing_urls)

        if dry_run:
            sample = listing_urls[:3]
            for url in sample:
                listing = await adapter.scrape_listing(browser, url, force_tier=force_tier)
                _print_listing(listing)
                await browser.delay()
            console.print(f"\n[dim](dry-run: showed {len(sample)} of {len(listing_urls)})[/]")
            return stats

        # Full run
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            "[progress.percentage]{task.percentage:>3.0f}%",
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task(f"Extracting {source_slug}...", total=len(listing_urls))
            for url in listing_urls:
                try:
                    listing = await adapter.scrape_listing(browser, url, force_tier=force_tier)
                    if listing.is_valid():
                        async with pool.acquire() as conn:
                            action = await upsert_listing(conn, listing, source_id, run_id)
                            stats.new += (action == "new")
                            stats.updated += (action == "updated")
                    progress.advance(task)
                    await browser.delay()
                except Exception as e:
                    logger.error("[%s] Error on %s: %s", source_slug, url, e)
                    stats.errors += 1
                    progress.advance(task)

        async with pool.acquire() as conn:
            await finish_scrape_run(
                conn, run_id,
                found=stats.found, new=stats.new, updated=stats.updated, errors=stats.errors,
            )

    finally:
        stats.duration_s = time.monotonic() - start

    console.print(
        f"  [bold green]✓ {source_slug}:[/] "
        f"{stats.found} found, {stats.new} new, {stats.updated} updated, "
        f"{stats.errors} errors [{stats.duration_s:.0f}s]"
    )
    return stats


async def run_all(
    *,
    max_pages: int = 50,
    dry_run: bool = False,
    sources: Optional[list[str]] = None,
) -> list[RunStats]:
    to_run = sources or list(ADAPTERS.keys())
    all_stats: list[RunStats] = []
    try:
        for slug in to_run:
            stats = await run_source(slug, max_pages=max_pages, dry_run=dry_run)
            all_stats.append(stats)
    finally:
        await shutdown_browser()
        await close_pool()
    _print_summary(all_stats)
    return all_stats


def _print_listing(listing: NormalizedListing) -> None:
    table = Table(title=f"[bold]{listing.title}[/]", show_header=False)
    table.add_column("Field", style="cyan")
    table.add_column("Value")
    table.add_row("URL", listing.listing_url)
    table.add_row("Price", listing.asking_price_raw or "—")
    table.add_row("Revenue", listing.revenue_raw or "—")
    table.add_row("Cash Flow", f"{listing.cash_flow_raw or '—'} ({listing.cash_flow_type or ''})")
    table.add_row("Location", f"{listing.city or ''}, {listing.state or ''}")
    table.add_row("Industry", listing.industry or "—")
    table.add_row("Tier", listing.extraction_tier)
    console.print(table)


def _print_summary(stats_list: list[RunStats]) -> None:
    table = Table(title="[bold]Scraping Summary[/]")
    table.add_column("Source", style="cyan")
    table.add_column("Found", justify="right")
    table.add_column("New", justify="right", style="green")
    table.add_column("Updated", justify="right", style="yellow")
    table.add_column("Errors", justify="right", style="red")
    table.add_column("Duration", justify="right")
    for s in stats_list:
        table.add_row(
            s.source, str(s.found), str(s.new), str(s.updated),
            str(s.errors), f"{s.duration_s:.0f}s"
        )
    console.print(table)


@click.command()
@click.option("--source", "-s", multiple=True, default=["all"],
              help=f"Source(s) to scrape. Options: all, {', '.join(ADAPTERS.keys())}")
@click.option("--pages", "-p", default=50, show_default=True, help="Max pages per source")
@click.option("--dry-run", is_flag=True, help="Print 3 sample listings, no DB writes")
@click.option("--tier", type=click.Choice(["tier1", "tier2", "tier3"]), default=None, help="Force extraction tier")
@click.option("--log-level", default="INFO", help="DEBUG, INFO, WARNING, ERROR")
def cli(source, pages, dry_run, tier, log_level):
    """DealFlow SMB listing scraper — BizBuySell, BizQuest, Acquire, TransWorld, Quiet Light, Flippa."""
    setup_logging(log_level)

    resolved: list[str] = []
    for s in source:
        if s == "all":
            resolved = list(ADAPTERS.keys())
            break
        elif s in ADAPTERS:
            resolved.append(s)
        else:
            click.echo(f"ERROR: Unknown source '{s}'. Valid: all, {', '.join(ADAPTERS.keys())}", err=True)
            sys.exit(1)
    if not resolved:
        resolved = list(ADAPTERS.keys())

    asyncio.run(run_all(max_pages=pages, dry_run=dry_run, sources=resolved))


if __name__ == "__main__":
    cli()
