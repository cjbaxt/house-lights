"""
Melkweg scraper — static HTML agenda page.
URL pattern: /nl/agenda/title-DD-MM-YYYY/
Date embedded in the slug and in the page HTML.
"""
import httpx
import re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.melkweg.nl/nl/agenda/"
BASE_URL = "https://www.melkweg.nl"

# Dutch month names used in the slug dates aren't needed — date is in the URL path
SLUG_DATE_RE = re.compile(r"-(\d{2})-(\d{2})-(\d{4})/?$")


def _parse_date_from_url(url: str) -> date | None:
    m = SLUG_DATE_RE.search(url)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


class MelkwegScraper(BaseScraper):
    key = "melkweg"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers={"Accept-Language": "nl"}) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        for link in soup.select("a[href*='/nl/agenda/']"):
            href = link.get("href", "")
            if not SLUG_DATE_RE.search(href):
                continue

            event_date = _parse_date_from_url(href)
            if not event_date:
                continue

            # Skip past dates
            if event_date < date.today():
                continue

            url = BASE_URL + href if href.startswith("/") else href

            # Title: look for heading or strong text inside the link
            title_el = link.select_one("h2, h3, h4, strong, .title, [class*='title']")
            title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
            title = re.sub(r"\s+", " ", title).strip()
            if not title or len(title) < 2:
                continue

            # Genre / subtitle — skip tag strings (·-separated genres)
            genre_el = link.select_one("[class*='genre'], [class*='tag'], [class*='category'], em")
            raw_subtitle = genre_el.get_text(strip=True) if genre_el else None
            subtitle = None if (raw_subtitle and "·" in raw_subtitle) else raw_subtitle

            # Sold out
            text = link.get_text(" ", strip=True)
            sold_out = "uitverkocht" in text.lower() or "sold out" in text.lower()
            ticket_status = "sold_out" if sold_out else "available"

            shows.append(ScrapedShow(
                title=title,
                subtitle=subtitle,
                date=event_date,
                url=url,
                source_id=f"melkweg:{href}",
                type="music",
                ticket_status=ticket_status,
            ))

        # Deduplicate by source_id (same event can appear multiple times as different links)
        seen = set()
        unique = []
        for s in shows:
            if s.source_id not in seen:
                seen.add(s.source_id)
                unique.append(s)

        return unique
