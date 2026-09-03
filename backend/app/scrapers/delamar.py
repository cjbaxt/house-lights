"""
DeLaMar — scrapes the agenda for show titles, then fetches each show page
for per-date entries using data-date attributes.
"""
import logging, asyncio
import httpx, re
from bs4 import BeautifulSoup
from datetime import date, time as dtime
from .base import BaseScraper, ScrapedShow, infer_type

logger = logging.getLogger(__name__)

AGENDA_URL = "https://www.delamar.nl/agenda"
BASE_URL = "https://www.delamar.nl"
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


class DeLaMarScraper(BaseScraper):
    key = "delamar"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            # Collect unique show hrefs from tiles
            hrefs: dict[str, str] = {}  # href → title
            for tile in soup.select("div.tile"):
                link = tile.select_one("a[href]")
                if not link:
                    continue
                href = link.get("href", "")
                if href in ("/", "/agenda", "/voorstellingen") or not href:
                    continue
                title_el = tile.select_one("h2, h3, h4, .tile__title, .tile__text")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    title = tile.get_text(" ", strip=True)[:60]
                if href not in hrefs and len(title) >= 2:
                    hrefs[href] = title

            # Fetch each show page in parallel
            async def fetch_show(href: str, title: str) -> list[ScrapedShow]:
                url = BASE_URL + href if href.startswith("/") else href
                shows = []
                try:
                    r = await client.get(url, timeout=20)
                    if r.status_code != 200:
                        return shows
                    ds = BeautifulSoup(r.text, "html.parser")

                    # Description
                    desc = None
                    meta = ds.select_one('meta[property="og:description"], meta[name="description"]')
                    if meta:
                        desc = meta.get("content", "").strip() or None
                    if not desc:
                        el = ds.select_one(".show-description, .production-description, .content, main p")
                        if el:
                            desc = el.get_text(" ", strip=True)[:1000] or None

                    # Image
                    img = ds.select_one('meta[property="og:image"]')
                    image_url = img.get("content") if img else None

                    show_type = infer_type(title, desc or "")

                    # Each date entry has data-date="YYYY-MM-DD"
                    today = date.today()
                    for date_div in ds.select(".production__date[data-date]"):
                        raw_date = date_div.get("data-date", "")
                        try:
                            d = date.fromisoformat(raw_date)
                        except ValueError:
                            continue
                        if d < today:
                            continue

                        # Time is text like "20:00"
                        text = date_div.get_text(" ", strip=True)
                        tm_match = TIME_RE.search(text)
                        tm = dtime(int(tm_match.group(1)), int(tm_match.group(2))) if tm_match else None

                        shows.append(ScrapedShow(
                            title=title,
                            date=d,
                            time=tm,
                            url=url,
                            source_id=f"delamar:{href}:{raw_date}",
                            type=show_type,
                            ticket_status="available",
                            description=desc,
                            image_url=image_url,
                        ))
                except Exception as e:
                    logger.warning("DeLaMar show page error %s: %s", href, e)
                return shows

            results = await asyncio.gather(*[fetch_show(h, t) for h, t in hrefs.items()])

        shows = []
        for batch in results:
            shows.extend(batch)
        return shows
