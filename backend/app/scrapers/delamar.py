"""
DeLaMar — static HTML, productions as div.tile with links.
Individual show pages needed for dates — scrape the full agenda page.
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.delamar.nl/agenda"
BASE_URL = "https://www.delamar.nl"

MONTHS_NL = {"januari":1,"februari":2,"maart":3,"april":4,"mei":5,"juni":6,
              "juli":7,"augustus":8,"september":9,"oktober":10,"november":11,"december":12,
              "jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month: return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = TIME_RE.search(text)
        from datetime import time
        tm = time(int(t.group(1)), int(t.group(2))) if t else None
        return d, tm
    except ValueError:
        return None, None


class DeLaMarScraper(BaseScraper):
    key = "delamar"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []
        seen = set()

        for tile in soup.select("div.tile"):
            link_el = tile.select_one("a[href]")
            if not link_el: continue
            href = link_el.get("href", "")
            if href in seen or href in ("/", "/agenda", "/voorstellingen"): continue
            seen.add(href)
            url = BASE_URL + href if href.startswith("/") else href

            text = tile.get_text(" ", strip=True)
            d, tm = _parse(text)

            title_el = tile.select_one("h2, h3, h4, .tile__title, .tile__text")
            title = title_el.get_text(strip=True) if title_el else text[:60]
            if not title or len(title) < 2: continue

            # If no date on tile, use today as placeholder — will be updated when we scrape show page
            if not d:
                d = date.today()

            shows.append(ScrapedShow(
                title=title, date=d, time=tm, url=url,
                source_id=f"delamar:{href}",
                type="theatre",
                ticket_status="available",
            ))

        return shows
