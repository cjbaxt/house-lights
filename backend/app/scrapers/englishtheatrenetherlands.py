"""
englishtheatrenetherlands.com — WordPress Events Calendar site.
Covers all English-language theatre companies in NL in one pass.
Uses Playwright (site 403s httpx with bot protection) for the listing page.
Detail pages are accessible with httpx.
"""
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

EVENTS_URL = "https://englishtheatrenetherlands.com/events/"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

_MONTH_NAMES = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
_DATE_RE = re.compile(rf"\b({_MONTH_NAMES})\s+(\d{{1,2}}),\s+(\d{{4}})", re.I)
_PREFIX_RE = re.compile(r"^\d{1,2}\s*[A-Za-z]{3}\s*\d{1,2}\s*[A-Za-z]{3}\s*(?:–\s*\d{1,2}\s*[A-Za-z]{3}\s*)?")
_SUFFIX_RE = re.compile(rf"\b{_MONTH_NAMES}\s+\d{{1,2}},\s+\d{{4}}.*$", re.I)
_SKIP_KEYWORDS = re.compile(
    r"workshop|audition|masterclass|play reading|stage lab|volunteer", re.I
)


def _parse_link(a_tag) -> tuple[str, date] | None:
    href = a_tag.get("href", "")
    if "/event/" not in href:
        return None
    text = a_tag.get_text(separator=" ", strip=True)
    m = _DATE_RE.search(text)
    if not m:
        return None
    month = MONTHS.get(m.group(1).lower())
    if not month:
        return None
    try:
        d = date(int(m.group(3)), month, int(m.group(2)))
    except ValueError:
        return None
    if d < date.today():
        return None
    title = _PREFIX_RE.sub("", text).strip()
    title = _SUFFIX_RE.sub("", title).strip()
    if not title or len(title) < 3:
        return None
    return title, d


class EnglishTheatreNetherlandsScraper(BaseScraper):
    key = "englishtheatrenetherlands"

    async def scrape(self) -> list[ScrapedShow]:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(EVENTS_URL, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            html = await page.content()
            await browser.close()

        soup = BeautifulSoup(html, "html.parser")
        items = []
        seen: set[tuple] = set()

        for a in soup.select('a[href*="/event/"]'):
            result = _parse_link(a)
            if not result:
                continue
            title, d = result
            if _SKIP_KEYWORDS.search(title):
                continue
            href = a.get("href", "")
            key = (title.lower(), d)
            if key in seen:
                continue
            seen.add(key)

            img_el = a.select_one("img[src]")
            image_url = img_el.get("src") if img_el else None

            items.append({
                "title": title, "date": d, "url": href,
                "source_id": f"etn:{href}:{d.isoformat()}",
                "image_url": image_url,
            })

        # Fetch descriptions from detail pages via httpx (listing uses Playwright but
        # individual event pages don't block httpx)
        async def fetch_desc(url: str) -> tuple[str, str | None]:
            try:
                async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                              headers={"User-Agent": "Mozilla/5.0"}) as c:
                    r = await c.get(url)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        for p in ds.find_all("p"):
                            txt = p.get_text(strip=True)
                            if len(txt) > 40:
                                return url, txt[:1000]
            except Exception:
                pass
            return url, None

        unique_urls = list({it["url"] for it in items})
        desc_results = await asyncio.gather(*[fetch_desc(u) for u in unique_urls])
        descriptions = dict(desc_results)

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"],
                date=it["date"],
                url=it["url"],
                source_id=it["source_id"],
                type="theatre",
                ticket_status="available",
                image_url=it["image_url"],
                description=descriptions.get(it["url"]),
            ))

        return shows
