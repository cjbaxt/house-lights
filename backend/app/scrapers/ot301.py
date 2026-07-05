"""
OT301 — static HTML.
Events as a.event-item; date from surrounding day header like "Friday 26 June"
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

EVENTS_URL = "https://www.ot301.nl/events"
BASE_URL = "https://www.ot301.nl"

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12}
DAY_HDR_RE = re.compile(r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?", re.I)
TIME_RE = re.compile(r"//\s*(\d{1,2}):(\d{2})")
YEAR_RE = re.compile(r"\b(202\d)\b")


class OT301Scraper(BaseScraper):
    key = "ot301"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(EVENTS_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            current_date = None

            for el in soup.select("div.agenda, div.day-block, .agenda > *"):
                # Check if this element is a day header
                txt = el.get_text(" ", strip=True)
                m = DAY_HDR_RE.match(txt)
                if m:
                    month = MONTHS.get(m.group(2).lower())
                    yr = int(m.group(3)) if m.group(3) else date.today().year
                    if month:
                        try:
                            current_date = date(yr, month, int(m.group(1)))
                        except ValueError:
                            current_date = None
                    continue

                # Event items within a day block
                for item in el.select("a.event-item") if el.name != "a" else [el]:
                    if not current_date: continue
                    href = item.get("href", "")
                    url = BASE_URL + href if href.startswith("/") else href
                    text = item.get_text(" ", strip=True)

                    tm_m = TIME_RE.search(text)
                    tm = time(int(tm_m.group(1)), int(tm_m.group(2))) if tm_m else None

                    title = text.split("//")[0].strip()[:80]
                    if not title or len(title) < 2: continue

                    free = "free" in text.lower() or "€ 0" in text or "€ free" in text.lower()
                    img_span = item.select_one("span.image[style*='background-image']")
                    image_url = None
                    if img_span:
                        import re as _re
                        m = _re.search(r"background-image:url\(([^)]+)\)", img_span.get("style", ""))
                        if m:
                            image_url = m.group(1).strip("'\"")
                    items.append({
                        "title": title, "date": current_date, "time": tm,
                        "url": url, "href": href,
                        "source_id": f"ot301:{href or title}:{current_date}",
                        "free": free, "image_url": image_url,
                    })

            # Fetch descriptions in parallel
            async def fetch_desc(url: str) -> tuple[str, str | None]:
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        el = ds.select_one("div.text")
                        if el:
                            return url, el.get_text(" ", strip=True)[:1000] or None
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
                source_id=it["source_id"],
                type="other",
                ticket_status="available",
                price_from=0 if it["free"] else None,
                description=descriptions.get(it["url"]),
                image_url=it.get("image_url"),
            ))

        return shows
