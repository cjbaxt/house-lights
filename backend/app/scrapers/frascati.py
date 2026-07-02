"""
Frascati — static HTML, same eventCard structure as Muziekgebouw.
Date format: "Thu 25 Jun '26"
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://frascatitheater.nl/en/agenda"
BASE_URL = "https://frascatitheater.nl"

MONTHS = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
           "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"\w{3}\s+(\d{1,2})\s+(\w{3})\s+['’](\d{2})", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None
    month = MONTHS.get(m.group(2).lower())
    if not month: return None
    try:
        return date(2000 + int(m.group(3)), month, int(m.group(1)))
    except ValueError:
        return None


class FrascatiScraper(BaseScraper):
    key = "frascati"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        for card in soup.select("li.eventCard"):
            link_el = card.select_one("a[href]")
            if not link_el: continue
            href = link_el.get("href", "")
            url = BASE_URL + href if href.startswith("/") else href

            text = card.get_text(" ", strip=True)
            d = _parse(text)
            if not d or d < date.today(): continue

            title_el = card.select_one("h2, h3, .title, .listItem__title")
            title = title_el.get_text(strip=True) if title_el else text[:60]
            if not title: continue

            sold_out = "sold out" in text.lower() or "uitverkocht" in text.lower()
            shows.append(ScrapedShow(
                title=title, date=d, url=url,
                source_id=f"frascati:{href}",
                type="theatre",
                ticket_status="sold_out" if sold_out else "available",
            ))

        return shows
