"""
Royal Concertgebouw — static HTML (Nuxt SSR).
Concerts on /concerten-en-tickets as article elements with /concerten/ links.
Date format: "ma 29 jun 2026"
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.concertgebouw.nl/concerten-en-tickets"
BASE_URL = "https://www.concertgebouw.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS_NL = {"jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
# "di 30 jun 2026"  or "ma 29 jun 2026"
DATE_RE = re.compile(r"\w{2}\s+(\d{1,2})\s+(\w{3})\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")
PRICE_RE = re.compile(r"v\.a\.\s*€\s*([\d,]+)")


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month: return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = TIME_RE.search(text)
        return d, time(int(t.group(1)), int(t.group(2))) if t else (d, None)
    except ValueError:
        return None, None


class ConcertgebouwFullScraper(BaseScraper):
    key = "concertgebouw"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for link in soup.select("a[href*='/concerten/']"):
                href = link.get("href", "")
                if href in seen or not href or href.rstrip("/") in ("/concerten", "/concerten-en-tickets"):
                    continue
                seen.add(href)
                url = BASE_URL + href if href.startswith("/") else href

                container = link.find_parent("li") or link.find_parent("article") or link
                text = container.get_text(" ", strip=True)

                d, tm = _parse(text)
                if not d or d < date.today():
                    continue

                title_el = container.select_one("h2, h3, h4, [class*='title']")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    # Extract from link text before the time
                    title = re.sub(r"\d{1,2}:\d{2}.*", "", link.get_text(strip=True)).strip()[:80]
                if not title:
                    continue

                sold_out = "uitverkocht" in text.lower()
                price_m = PRICE_RE.search(text)
                price = float(price_m.group(1).replace(",", ".")) if price_m else None

                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                               "sold_out": sold_out, "price": price})

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
                price_from=it["price"],
                description=descriptions.get(it["url"]),
            ))

        return shows
