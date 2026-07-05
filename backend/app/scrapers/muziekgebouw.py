"""
Muziekgebouw aan 't IJ — static HTML.
Events as li.eventCard; date like "Sat 27 Jun 2026 17:00"
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.muziekgebouw.nl/en/agenda"
BASE_URL = "https://www.muziekgebouw.nl"

MONTHS = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
           "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"\w{3}\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    month = MONTHS.get(m.group(2).lower())
    if not month: return None, None
    try:
        return date(int(m.group(3)), month, int(m.group(1))), time(int(m.group(4)), int(m.group(5)))
    except ValueError:
        return None, None


class MuziekgebouwScraper(BaseScraper):
    key = "muziekgebouw"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []

            for card in soup.select("li.eventCard"):
                link_el = card.select_one("a[href*='/agenda/']")
                if not link_el: continue
                href = link_el.get("href", "")
                url = BASE_URL + href if href.startswith("/") else href

                text = card.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < date.today(): continue

                title_el = card.select_one("h2, h3, .title, .listItem__title")
                title = title_el.get_text(strip=True) if title_el else text.split(d.strftime("%b"))[0].strip()[:80]
                if not title: continue

                sold_out = "sold out" in text.lower() or "uitverkocht" in text.lower()
                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                               "sold_out": sold_out})

            # Fetch descriptions from detail pages in parallel
            async def fetch_desc(url: str) -> tuple[str, str | None]:
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        meta = ds.select_one('meta[property="og:description"], meta[name="description"]')
                        if meta:
                            desc = meta.get("content", "").strip()
                            if desc:
                                return url, desc
                        el = ds.select_one(".event-description, .description, .content, main p")
                        if el:
                            text = el.get_text(" ", strip=True)[:1000]
                            if text:
                                return url, text
                except Exception:
                    pass
                return url, None

            unique_urls = list({it["url"] for it in items})
            desc_results = await asyncio.gather(*[fetch_desc(u) for u in unique_urls])
            descriptions = dict(desc_results)

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"muziekgebouw:{it['href']}",
                type="classical",
                ticket_status="sold_out" if it["sold_out"] else "available",
                description=descriptions.get(it["url"]),
            ))

        return shows
