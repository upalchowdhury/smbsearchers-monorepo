"""
Orchestrator — runs one or all scrapers, coordinates database writes,
tracks progress with rich console output.
"""
from __future__ import annotations
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

from .core.browser import BrowserService, get_browser, shutdown_browser
from .core.db import get_pool, close_pool, ensure_source, create_scrape_run, finish_scrape_run, upsert_listing
from .core.models import NormalizedListing

logger = logging.getLogger(__name__)
console = Console()

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


async def run_source(
    source_slug: str,
    *,
    max_pages: int = 50,
    dry_run: bool = False,
    force_tier: Optional[str] = None,
) -> RunStats:
    """Run a single source scraper end-to-end."""
    if source_slug not in ADAPTERS:
        raise ValueError(f"Unknown source: {source_slug}. Valid: {list(ADAPTERS)}")

    import importlib
    adapter = importlib.import_module(f".{ADAPTERS[source_slug]}", package="scraper_pkg")

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

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=True,
        ) as progress:
            disc_task = progress.add_task(f"[green]Discovering URLs...", total=None)
            listing_urls: list[str] = []

            async for url in adapter.discover_urls(browser, max_pages=max_pages):
                listing_urls.append(url)
                progress.update(disc_task, description=f"[green]Found {len(listing_urls)} listing URLs...")

        console.print(f"  [green]Discovered {len(listing_urls)} URLs for [bold]{source_slug}[/]")
        stats.found = len(listing_urls)

        if dry_run:
            # In dry-run mode, just scrape a few and print
            sample = listing_urls[:3]
            for url in sample:
                listing = await adapter.scrape_listing(browser, url, force_tier=force_tier)
                _print_listing(listing)
                await browser.delay()
            console.print(f"\n[dim](dry-run: showed {len(sample)} of {len(listing_urls)})[/]")
            return stats

        # Real run — scrape and persist with parallel extraction
        LISTING_CONCURRENCY = 5  # 5 simultaneous TinyFish calls
        sem = asyncio.Semaphore(LISTING_CONCURRENCY)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            "[progress.percentage]{task.percentage:>3.0f}%",
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            scrape_task = progress.add_task(f"Extracting {source_slug}...", total=len(listing_urls))

            async def process_one(url: str):
                async with sem:
                    try:
                        listing = await adapter.scrape_listing(browser, url, force_tier=force_tier)
                        if listing.is_valid():
                            async with pool.acquire() as conn:
                                action = await upsert_listing(conn, listing, source_id, run_id)
                                if action == "new":
                                    stats.new += 1
                                else:
                                    stats.updated += 1
                    except Exception as e:
                        logger.error("[%s] Error on %s: %s", source_slug, url, e)
                        stats.errors += 1
                    finally:
                        progress.advance(scrape_task)

            await asyncio.gather(*[process_one(url) for url in listing_urls])

        # Finalize run record
        async with pool.acquire() as conn:
            await finish_scrape_run(
                conn, run_id,
                found=stats.found,
                new=stats.new,
                updated=stats.updated,
                errors=stats.errors,
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
    concurrency: int = 1,
) -> list[RunStats]:
    """Run all (or selected) sources, optionally in parallel."""
    to_run = sources if sources else list(ADAPTERS.keys())
    all_stats: list[RunStats] = []

    try:
        if concurrency > 1:
            semaphore = asyncio.Semaphore(concurrency)
            async def bounded(slug):
                async with semaphore:
                    return await run_source(slug, max_pages=max_pages, dry_run=dry_run)
            results = await asyncio.gather(*[bounded(s) for s in to_run], return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    logger.error("Source failed: %s", r)
                else:
                    all_stats.append(r)
        else:
            # Sequential (safer for browser resources)
            for slug in to_run:
                stats = await run_source(slug, max_pages=max_pages, dry_run=dry_run)
                all_stats.append(stats)
    finally:
        await shutdown_browser()
        await close_pool()

    _print_summary(all_stats)
    return all_stats


def _print_listing(listing: NormalizedListing) -> None:
    """Pretty-print a single listing for dry-run output."""
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
