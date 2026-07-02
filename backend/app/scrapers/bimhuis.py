"""
Bimhuis scraper — static HTML.
Structure: li.agenda-tile-overview__item > div.agenda-tile > div.agenda-tile__content
Date format: "vr 26 juni 2026 20:30" (Dutch)
"""
import httpx
import re
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.bimhuis.nl/agenda/"
BASE_URL = "https://www.bimhuis.nl"

MONTHS_NL = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "augustus": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}

DATE_RE = re.compile(r"\w{2}\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})")


def _parse(text: str) -> tuple[date, time] | tuple[None, None]:
    m = DATE_RE.search(text)
    if not m:
        return None, None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month:
        return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = time(int(m.group(4)), int(m.group(5)))
        return d, t
    except ValueError:
        return None, None


class BimhuisScraper(BaseScraper):
    key = "bimhuis"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        for tile in soup.select("div.agenda-tile"):
            link_el = tile.select_one("a[href*='/agenda/']")
            if not link_el:
                continue

            href = link_el.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href
            title = link_el.get_text(strip=True)
            if not title:
                continue

            full_text = tile.get_text(" ", strip=True)
            event_date, event_time = _parse(full_text)
            if not event_date or event_date < date.today():
                continue

            cancelled = "geannuleerd" in full_text.lower() or "cancelled" in full_text.lower()

            shows.append(ScrapedShow(
                title=title,
                date=event_date,
                time=event_time,
                url=url,
                source_id=f"bimhuis:{href}",
                type="music",
                ticket_status="sold_out" if cancelled else "available",
            ))

        return shows
