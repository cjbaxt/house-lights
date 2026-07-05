"""
InPlayers — Squarespace site, static HTML.
Events at /upcoming-events/ with date "Sat, DD Mon YYYY HH:MM"
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

EVENTS_URL = "https://inplayers.org/upcoming-events/"
BASE_URL = "https://inplayers.org"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
# "Fri, 5 Jun 2026 14:30"
DATE_RE = re.compile(r"\w{3},?\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})", re.I)
DATE_SHORT = re.compile(r"\w{3},?\s+(\d{1,2})\s+(\w{3})\s+(\d{4})", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if m:
        month = MONTHS.get(m.group(2).lower())
        if month:
            try:
                return date(int(m.group(3)), month, int(m.group(1))), time(int(m.group(4)), int(m.group(5)))
            except ValueError: pass
    m2 = DATE_SHORT.search(text)
    if m2:
        month = MONTHS.get(m2.group(2).lower())
        if month:
            try:
                return date(int(m2.group(3)), month, int(m2.group(1))), None
            except ValueError: pass
    return None, None


class InPlayersScraper(BaseScraper):
    key = "inplayers"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(EVENTS_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for item in soup.select("article, .eventlist-event, li[class*='event']"):
                link_el = item.select_one("a[href*='/upcoming-events/'], a[href]")
                if not link_el: continue
                href = link_el.get("href", "")
                if href in seen: continue
                seen.add(href)
                url = href if href.startswith("http") else BASE_URL + href

                text = item.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < date.today(): continue

                title_el = item.select_one("h1, h2, h3, .eventlist-title")
                title = title_el.get_text(strip=True) if title_el else text[:60]
                if not title: continue

                # Description from the listing card
                desc_el = item.select_one(".eventlist-description, .event-excerpt, p")
                description = desc_el.get_text(" ", strip=True)[:1000] if desc_el else None

                img_el = item.select_one("img")
                image_url = img_el.get("src") if img_el else None
                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                               "description": description, "image_url": image_url})

            # If no description from listing, fetch from detail pages
            no_desc = [it for it in items if not it["description"]]
            if no_desc:
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
                            el = ds.select_one(".eventlist-description, .sqs-block-content, .entry-content")
                            if el:
                                text = el.get_text(" ", strip=True)[:1000]
                                if text:
                                    return url, text
                    except Exception:
                        pass
                    return url, None

                detail_results = await asyncio.gather(*[fetch_desc(it["url"]) for it in no_desc])
                detail_descs = dict(detail_results)
                for it in no_desc:
                    it["description"] = detail_descs.get(it["url"])

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"inplayers:{it['href']}",
                type="theatre",
                ticket_status="available",
                description=it["description"],
                image_url=it.get("image_url"),
            ))

        return shows
