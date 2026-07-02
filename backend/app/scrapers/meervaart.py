"""
De Meervaart — static HTML (Tailwind-based site).
Events as article elements; date like "vr 26 jun"
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.demeervaart.nl/agenda"
BASE_URL = "https://www.demeervaart.nl"

MONTHS_NL = {"jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
# "vr 26 jun" — no year, infer from context
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
        # If parsed date is in the past and no year found, try next year
        if d < date.today() and not yr:
            d = date(year + 1, month, int(m.group(1)))
        return d
    except ValueError:
        return None


class MeervaartScraper(BaseScraper):
    key = "meervaart"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        for article in soup.select("article"):
            link_el = article.select_one("a[href*='/agenda/']")
            if not link_el: continue
            href = link_el.get("href", "")
            url = BASE_URL + href if href.startswith("/") else href

            text = article.get_text(" ", strip=True)
            d = _parse(text)
            if not d or d < date.today(): continue

            cancelled = "geannuleerd" in text.lower() or "afgelast" in text.lower()
            if cancelled: continue

            title_el = article.select_one("h2, h3, h4, [class*='title']")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title: continue

            sold_out = "uitverkocht" in text.lower() or "sold out" in text.lower()

            shows.append(ScrapedShow(
                title=title, date=d, url=url,
                source_id=f"meervaart:{href}",
                type="theatre",
                ticket_status="sold_out" if sold_out else "available",
            ))

        return shows
