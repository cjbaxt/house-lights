"""
Boom Chicago — scrapes the /shows/ page.
Dates are encoded in the h4 activity titles:
  - Explicit one-off:  "Ralph Barbosa • July 13, 2026"
  - Festival:          "BCCF 2026 • Title • July 3"
  - Multi-day:         "Title • August 1 & 2, 2026"
  - Recurring:         "Title • Wednesdays" — uses FareHarbor bookability API
  - No date:           skipped
"""
import re
import httpx
import asyncio
from datetime import date, time, timedelta
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapedShow

SHOWS_URL = "https://boomchicago.nl/shows/"
BASE_URL = "https://boomchicago.nl"
FH_BOOKABILITY = "https://fareharbor.com/api/embed/boomchicago/bookability/v1/"
FH_REFERER = "https://boomchicago.nl/"
# How many months ahead to check for recurring shows
FH_MONTHS_AHEAD = 3

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?"
    r"(?:\s*[&]\s*(\d{1,2})(?:st|nd|rd|th)?)?"
    r"(?:,?\s*(\d{4}))?$",
    re.I,
)
_TIME_RE = re.compile(r"\bat\s+(\d{1,2}):(\d{2})", re.I)
_IS_RECURRING = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"mon|tue|wed|thu|fri|sat|sun)s?\b",
    re.I,
)
_PK_RE = re.compile(r"items/(\d+)")


def _parse_explicit(segment: str, today: date) -> list[date]:
    m = _DATE_RE.search(segment.strip())
    if not m:
        return []
    month_str, d1_str, d2_str, year_str = m.groups()
    month = MONTH_MAP.get(month_str.lower())
    if not month:
        return []
    year = int(year_str) if year_str else (today.year if month >= today.month else today.year + 1)
    try:
        d1 = date(year, month, int(d1_str))
    except ValueError:
        return []
    if d1 < today and not year_str:
        try:
            d1 = date(year + 1, month, int(d1_str))
        except ValueError:
            return []
    dates = [d1]
    if d2_str:
        try:
            dates.append(date(d1.year, month, int(d2_str)))
        except ValueError:
            pass
    return dates


def _fareharbor_dates(item_pk: str, today: date) -> list[date]:
    """Fetch actual bookable dates from the public FareHarbor embed API."""
    end = today.replace(day=1)
    for _ in range(FH_MONTHS_AHEAD):
        # advance end by one month
        if end.month == 12:
            end = end.replace(year=end.year + 1, month=1)
        else:
            end = end.replace(month=end.month + 1)

    try:
        resp = httpx.get(
            FH_BOOKABILITY,
            params={"start_date": today.isoformat(), "end_date": end.isoformat(), "item_pks": item_pk},
            headers={"Referer": FH_REFERER, "User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            date.fromisoformat(a["date"])
            for a in data.get("availabilities", [])
            if a.get("status") == "bookable"
        ]
    except Exception:
        return []


def _parse_title(raw_title: str, today: date):
    """Returns (clean_title, is_recurring, explicit_dates, time_obj, sold_out)."""
    sold_out = bool(re.match(r"sold\s+out", raw_title, re.I))
    title = re.sub(r"^sold\s+out\s*[•·]\s*", "", raw_title, flags=re.I)
    title = re.sub(r"^bccf\s+\d+\s*[•·]\s*", "", title, flags=re.I)

    parts = re.split(r"\s*[•·]\s*", title)
    clean_title = parts[0].strip()

    t_obj: time | None = None
    tm = _TIME_RE.search(raw_title)
    if tm:
        try:
            t_obj = time(int(tm.group(1)), int(tm.group(2)))
        except ValueError:
            pass

    # Try explicit dates
    dates: list[date] = []
    for seg in reversed(parts):
        dates = _parse_explicit(seg, today)
        if dates:
            break

    # Detect recurring pattern (day-of-week in title)
    is_recurring = bool(not dates and _IS_RECURRING.search(raw_title))

    return clean_title, is_recurring, dates, t_obj, sold_out


class BoomChicagoScraper(BaseScraper):
    key = "boomchicago"

    async def scrape(self) -> list[ScrapedShow]:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(SHOWS_URL, timeout=45000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            html = await page.content()
            await browser.close()

        soup = BeautifulSoup(html, "html.parser")
        today = date.today()
        seen_source_ids: set[str] = set()
        items: list[dict] = []

        for card in soup.select("article.activity-single--card"):
            title_el = card.select_one(".activity__title")
            link_el = card.select_one("a[href]")
            if not title_el or not link_el:
                continue

            raw_title = title_el.get_text(strip=True)
            href = link_el.get("href", "")
            if not href or href == "#":
                continue
            url = href if href.startswith("http") else BASE_URL + href

            img_el = card.select_one("img[src]")
            image_url = img_el.get("src") if img_el else None

            clean_title, is_recurring, dates, t_obj, sold_out = _parse_title(raw_title, today)
            if not clean_title or len(clean_title) < 3:
                continue

            # For recurring shows, fetch actual dates from FareHarbor
            if is_recurring:
                pks = _PK_RE.findall(str(card))
                if pks:
                    dates = _fareharbor_dates(pks[0], today)

            if not dates:
                continue

            status = "sold_out" if sold_out else "available"

            for d in dates:
                if d < today:
                    continue
                source_id = f"boomchicago:{href}:{d.isoformat()}"
                if source_id in seen_source_ids:
                    continue
                seen_source_ids.add(source_id)
                items.append({
                    "title": clean_title, "date": d, "time": t_obj,
                    "url": url, "href": href, "source_id": source_id,
                    "ticket_status": status, "image_url": image_url,
                })

        # Fetch descriptions and images from detail pages (one per unique URL)
        async def fetch_detail(url: str) -> tuple[str, str | None, str | None]:
            try:
                async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                              headers={"User-Agent": "Mozilla/5.0"}) as c:
                    r = await c.get(url)
                    if r.status_code == 200:
                        s = BeautifulSoup(r.text, "html.parser")
                        desc = None
                        meta = s.select_one("meta[name=description]")
                        if meta:
                            desc = meta.get("content", "").strip() or None
                        img = None
                        og_img = s.select_one("meta[property='og:image']")
                        if og_img:
                            img = og_img.get("content", "").strip() or None
                        return url, desc, img
            except Exception:
                pass
            return url, None, None

        unique_urls = list({it["url"] for it in items})
        detail_results = await asyncio.gather(*[fetch_detail(u) for u in unique_urls])
        descriptions = {u: d for u, d, _ in detail_results}
        images = {u: i for u, _, i in detail_results}

        shows: list[ScrapedShow] = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"],
                date=it["date"],
                time=it["time"],
                url=it["url"],
                source_id=it["source_id"],
                type="comedy",
                ticket_status=it["ticket_status"],
                image_url=images.get(it["url"]),
                description=descriptions.get(it["url"]),
            ))

        return shows
