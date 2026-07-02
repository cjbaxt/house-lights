"""
Bird Brain Theatre — static HTML tickets page.
Shows listed as anchor blocks containing title, city, dates, venue.
Date format: "5, 6, 7 of June 2026" or "19 & 21 of June 2026"
Each block links to an external ticket URL (Eventbrite / weticket).
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

TICKETS_URL = "https://www.birdbraintheatre.nl/tickets.html"
BASE_URL = "https://www.birdbraintheatre.nl"

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12}

# "5, 6, 7 of June 2026"  or  "19 & 21 of June 2026"
_DATE_BLOCK_RE = re.compile(
    r"([\d,\s&]+)\s+of\s+([A-Za-z]+)\s+(\d{4})", re.I
)
_NAV_TEXTS = {"home", "tickets", "previous shows", "about"}


def _parse_dates(text: str, today: date) -> list[date]:
    dates = []
    for m in _DATE_BLOCK_RE.finditer(text):
        raw_days, month_str, year_str = m.groups()
        month = MONTHS.get(month_str.lower())
        if not month:
            continue
        year = int(year_str)
        days = [int(d) for d in re.findall(r"\d+", raw_days)]
        for day in days:
            try:
                d = date(year, month, day)
                if d >= today:
                    dates.append(d)
            except ValueError:
                pass
    return dates


class BirdbBrainTheatreScraper(BaseScraper):
    key = "birdbraintheatre"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(TICKETS_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        today = date.today()
        shows = []
        seen: set[str] = set()

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            if not href.startswith("http"):
                continue
            # Skip nav and social links
            text = link.get_text(" ", strip=True)
            first_line = text.split("\n")[0].strip()
            if first_line.lower() in _NAV_TEXTS or not text:
                continue
            if "instagram.com" in href or "mailto:" in href:
                continue

            dates = _parse_dates(text, today)
            if not dates:
                continue

            # Title is everything before "Tickets" in the link text, minus trailing city
            title = re.split(r"\s*Tickets\b", text, flags=re.I)[0].strip()
            # City may be appended with or without space (e.g. "HamletAmsterdam" or "Hamlet Amsterdam")
            title = re.sub(r"\s*\b(Amsterdam|Leiden|The Hague|Rotterdam|Utrecht)\s*$", "", title, flags=re.I).strip()
            if not title or len(title) < 2:
                continue

            for d in dates:
                source_id = f"birdbraintheatre:{href}:{d.isoformat()}"
                if source_id in seen:
                    continue
                seen.add(source_id)
                shows.append(ScrapedShow(
                    title=title, date=d, url=href,
                    source_id=source_id,
                    type="theatre",
                    ticket_status="available",
                ))

        return shows
