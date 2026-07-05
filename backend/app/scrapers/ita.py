"""
ITA (Internationaal Theater Amsterdam) — static HTML.
Events as a.agendaItem__item
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://ita.nl/en/agenda"
BASE_URL = "https://ita.nl"

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
DATE_SHORT = re.compile(r"\w{3}\s+(\d{1,2})\s+(\w{3})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse(text):
    from datetime import time as time_type
    # Try full date first (DD Month YYYY)
    m = DATE_RE.search(text)
    if m:
        month = MONTHS.get(m.group(2).lower())
        if month:
            try:
                d = date(int(m.group(3)), month, int(m.group(1)))
                t = TIME_RE.search(text)
                return d, time_type(int(t.group(1)), int(t.group(2))) if t else None
            except ValueError:
                pass
    # Fall back to short "Fri 26 Jun" — infer year
    m2 = DATE_SHORT.search(text)
    if m2:
        month = MONTHS.get(m2.group(2).lower())
        if month:
            try:
                year = date.today().year
                d = date(year, month, int(m2.group(1)))
                if d < date.today():
                    d = date(year + 1, month, int(m2.group(1)))
                t = TIME_RE.search(text)
                return d, time_type(int(t.group(1)), int(t.group(2))) if t else None
            except ValueError:
                pass
    return None, None


class ITAScraper(BaseScraper):
    key = "ita"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for item in soup.select("a.agendaItem__item, .agendaItem a[href]"):
                href = item.get("href", "")
                if not href or href in seen: continue
                seen.add(href)
                url = BASE_URL + href if href.startswith("/") else href

                # Date is in the .row parent, not the link itself
                row = item.find_parent(class_="row") or item
                text = row.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < date.today(): continue

                # Title comes from the link itself, not the row (which has date prefix)
                title_el = item.select_one(".agendaItem__title, h2, h3, strong")
                title = title_el.get_text(strip=True) if title_el else item.get_text(" ", strip=True)
                # Strip any leading date like "Fri 26 Jun"
                title = re.sub(r"^\w{3}\s+\d{1,2}\s+\w{3}\s+", "", title).strip()[:80]
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
                        el = ds.select_one(".production-description, .content-body, .show-description, main p")
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
                source_id=f"ita:{it['href']}",
                type="theatre",
                ticket_status="sold_out" if it["sold_out"] else "available",
                description=descriptions.get(it["url"]),
            ))

        return shows
