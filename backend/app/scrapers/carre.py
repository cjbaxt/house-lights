"""
Koninklijk Theater Carré — uses the internal render API.

1. GET /api/render/production-page-list-nl  → list of show node IDs
2. GET /api/render/voorstelling/{slug}       → per-show data including
   data["productions"][production_id]["events"] with start_date + ticketsFree/Total

No Playwright needed.
"""
import re
import httpx
import asyncio
from html.parser import HTMLParser
from datetime import date, datetime
from .base import BaseScraper, ScrapedShow

BASE_URL = "https://carre.nl"
API_BASE = "https://carre.nl/api/render"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://carre.nl/"}


def _strip_html(html: str) -> str:
    """Extract plain text from HTML, collapsing whitespace."""
    class _P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
    p = _P()
    p.feed(html)
    return re.sub(r"\s+", " ", "".join(p.parts)).strip()


def _extract_description(node_data: dict) -> str | None:
    for key in ("seoDescription", "contentMain", "subheading"):
        val = node_data.get(key)
        if not val:
            continue
        text = _strip_html(val) if "<" in val else val.strip()
        if text and len(text) > 20:
            return text
    return None


def _ticket_status(event: dict) -> str:
    free = event.get("ticketsFree")
    total = event.get("ticketsTotal")
    if free is not None and free == 0:
        return "sold_out"
    if free is not None and total and free / total < 0.1:
        return "few_left"
    return "available"


def _extract_image(data: dict) -> str | None:
    """Get the per-production image via node.relations.image_header_large (or fallbacks)."""
    nodes = data.get("nodes", {})
    rels = data.get("node", {}).get("relations", {})
    for key in ("image_header_large", "image_header_small", "image_thumb"):
        node_id = rels.get(key)
        if not node_id:
            continue
        node = nodes.get(node_id, {})
        cdn_path = node.get("data", {}).get("cdn_url_path", "")
        uuid = cdn_path.split("/")[0] if cdn_path else None
        if uuid and len(uuid) == 36:
            return f"https://static.carre.nl/{uuid}.jpg"
    return None


def _extract_shows(data: dict, slug: str, today: date) -> list[ScrapedShow]:
    node = data.get("node", {})
    node_data = node.get("data", {})
    # Use heading (display title) preferring over internal title
    title = node_data.get("heading") or node_data.get("title") or slug.replace("-", " ").title()
    url = f"{BASE_URL}/voorstelling/{slug}"
    image_url = _extract_image(data)
    description = _extract_description(node_data)

    productions = data.get("productions", {})
    shows: list[ScrapedShow] = []
    seen_dates: set[date] = set()

    for prod in productions.values():
        for event in prod.get("events", []):
            start_raw = event.get("start_date", "")
            if not start_raw:
                continue
            try:
                dt = datetime.fromisoformat(start_raw)
            except ValueError:
                continue
            d = dt.date()
            if d < today or d in seen_dates:
                continue
            seen_dates.add(d)
            shows.append(ScrapedShow(
                title=title,
                date=d,
                time=dt.time() if dt.time().hour != 0 or dt.time().minute != 0 else None,
                url=url,
                source_id=f"carre:{slug}:{d.isoformat()}",
                type="theatre",
                ticket_status=_ticket_status(event),
                image_url=image_url,
                description=description,
            ))

    return sorted(shows, key=lambda s: s.date)


class CarreScraper(BaseScraper):
    key = "carre"

    async def scrape(self) -> list[ScrapedShow]:
        today = date.today()

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=HEADERS) as client:
            # Step 1: get all production slugs from the agenda page links
            # We use the Playwright-rendered agenda to discover slugs (the API
            # list endpoint gives only node IDs, not slugs directly)
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(f"{BASE_URL}/agenda", timeout=40000, wait_until="networkidle")
                await page.wait_for_timeout(3000)
                slug_hrefs: list[str] = await page.evaluate("""
                    Array.from(new Set(
                        Array.from(document.querySelectorAll('a[href*="/voorstelling/"]'))
                          .map(a => a.href.split('/voorstelling/')[1].split('#')[0].split('?')[0])
                          .filter(s => s && !s.includes('/'))
                    ))
                """)
                await browser.close()

            # Step 2: fetch each show's render API in parallel
            async def fetch_show(slug: str):
                try:
                    r = await client.get(f"{API_BASE}/voorstelling/{slug}")
                    if r.status_code == 200:
                        return slug, r.json()
                except Exception:
                    pass
                return slug, None

            results = await asyncio.gather(*[fetch_show(slug) for slug in slug_hrefs])

        all_shows: list[ScrapedShow] = []
        seen_source_ids: set[str] = set()

        for slug, data in results:
            if not data:
                continue
            for show in _extract_shows(data, slug, today):
                if show.source_id not in seen_source_ids:
                    seen_source_ids.add(show.source_id)
                    all_shows.append(show)

        return all_shows
