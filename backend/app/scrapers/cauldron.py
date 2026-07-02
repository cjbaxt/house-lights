"""
The Cauldron Performing Arts — WordPress site, static HTML.
Events as article elements with "DD Month YYYY" dates.
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

HOME_URL = "https://www.cauldronperformingarts.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None
    month = MONTHS.get(m.group(2).lower())
    if not month: return None
    try:
        return date(int(m.group(3)), month, int(m.group(1)))
    except ValueError:
        return None


class CauldronScraper(BaseScraper):
    key = "cauldron"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(HOME_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []
        seen = set()

        for article in soup.select("article"):
            link_el = article.select_one("a[href]")
            if not link_el: continue
            href = link_el.get("href", "")
            if href in seen: continue
            seen.add(href)
            url = href if href.startswith("http") else HOME_URL + href

            text = article.get_text(" ", strip=True)
            d = _parse(text)
            if not d or d < date.today(): continue

            title_el = article.select_one("h1, h2, h3, [class*='title']")
            title = title_el.get_text(strip=True) if title_el else text[:60]
            if not title: continue

            shows.append(ScrapedShow(
                title=title, date=d, url=url,
                source_id=f"cauldron:{href}",
                type="theatre",
                ticket_status="available",
            ))

        return shows
