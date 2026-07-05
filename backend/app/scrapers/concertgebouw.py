"""
Royal Concertgebouw — static HTML.
Events as <article> on homepage; date like "di 30 jun 2026"
Full agenda: /concerten
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

BASE_URL = "https://www.concertgebouw.nl"
AGENDA_URL = f"{BASE_URL}/"

MONTHS_NL = {
    "jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12,
}
DATE_RE = re.compile(r"\w{2}\s+(\d{1,2})\s+(\w{3})\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month: return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = TIME_RE.search(text)
        tm = None
        if t:
            from datetime import time
            tm = time(int(t.group(1)), int(t.group(2)))
        return d, tm
    except ValueError:
        return None, None


class ConcertgebouwScraper(BaseScraper):
    key = "concertgebouw"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for article in soup.select("article"):
                link_el = article.select_one("a[href*='/concerten/']")
                if not link_el:
                    continue
                href = link_el.get("href", "")
                if href in seen:
                    continue
                seen.add(href)
                url = BASE_URL + href if href.startswith("/") else href

                text = article.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < date.today():
                    continue

                title_el = article.select_one("h2, h3, h4, strong")
                title = title_el.get_text(strip=True) if title_el else re.sub(DATE_RE, "", text).strip()[:80]
                if not title:
                    continue

                sold_out = "uitverkocht" in text.lower()
                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href, "sold_out": sold_out})

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
                        el = ds.select_one(".concert-description, .description, .content-body, main p")
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
                source_id=f"concertgebouw:{it['href']}",
                type="classical",
                ticket_status="sold_out" if it["sold_out"] else "available",
                description=descriptions.get(it["url"]),
            ))

        return shows
