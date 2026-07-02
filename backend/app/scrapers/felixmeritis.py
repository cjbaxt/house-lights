"""
Felix Meritis — WordPress-based static HTML.
Events as div.event-list__meta + h2.event-list__title
Date format: "vr 3 jul"
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://felixmeritis.nl/programma/"
BASE_URL = "https://felixmeritis.nl"

MONTHS_NL = {"jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"\w{2}\s+(\d{1,2})\s+(\w{3})", re.I)
YEAR_RE = re.compile(r"\b(202\d)\b")


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month: return None
    yr = YEAR_RE.search(text)
    year = int(yr.group(1)) if yr else date.today().year
    try:
        d = date(year, month, int(m.group(1)))
        if d < date.today() and not yr:
            d = date(year + 1, month, int(m.group(1)))
        return d
    except ValueError:
        return None


class FelixMeritisScraper(BaseScraper):
    key = "felixmeritis"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        # Each event: find pairs of meta+title in the event list
        for item in soup.select(".event-list__item, article, li"):
            meta = item.select_one(".event-list__meta")
            title_el = item.select_one("h2.event-list__title, h3, h2")
            if not meta or not title_el: continue

            title = title_el.get_text(strip=True)
            if not title: continue

            link_el = item.select_one("a[href]")
            href = link_el.get("href", "") if link_el else ""
            url = BASE_URL + href if href.startswith("/") else href or AGENDA_URL

            text = meta.get_text(" ", strip=True) + " " + title
            d = _parse(text)
            if not d or d < date.today(): continue

            sold_out = "uitverkocht" in text.lower() or "sold out" in text.lower()
            shows.append(ScrapedShow(
                title=title, date=d, url=url,
                source_id=f"felixmeritis:{href or title}",
                type="other",
                ticket_status="sold_out" if sold_out else "available",
            ))

        return shows
