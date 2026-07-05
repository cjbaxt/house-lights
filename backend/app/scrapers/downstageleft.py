"""
Down Stage Left — WordPress site, static HTML.
Events as article elements; ticket links point to Badhuistheater.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

HOME_URL = "https://downstageleft.org"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
DATE_RE2 = re.compile(r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse(text):
    for pattern in [DATE_RE, DATE_RE2]:
        m = pattern.search(text)
        if not m: continue
        if pattern == DATE_RE:
            month = MONTHS.get(m.group(2).lower())
            day, year = int(m.group(1)), int(m.group(3))
        else:
            month = MONTHS.get(m.group(1).lower())
            day, year = int(m.group(2)), int(m.group(3))
        if not month: continue
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return None


def _parse_time(text):
    m = TIME_RE.search(text)
    if not m: return None
    try:
        from datetime import time
        return time(int(m.group(1)), int(m.group(2)))
    except ValueError:
        return None


class DownStageLeftScraper(BaseScraper):
    key = "downstageleft"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(HOME_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for article in soup.select("article"):
                text = article.get_text(" ", strip=True)
                # Skip non-show articles (about, contact panels)
                if any(skip in text.lower() for skip in ("about us", "contact", "panel 2", "panel 3")): continue

                d = _parse(text)
                if not d or d < date.today(): continue

                tm = _parse_time(text)

                title_el = article.select_one("h1, h2, h3")
                title = title_el.get_text(strip=True) if title_el else ""
                # Strip subtitle after comma
                title = re.sub(r",\s*(by|presented).*", "", title, flags=re.I).strip()[:80]
                if not title: continue

                link_el = article.select_one("a[href*='tickets'], a[href*='badhuistheater'], a[href]")
                href = link_el.get("href", "") if link_el else HOME_URL
                url = href if href.startswith("http") else HOME_URL + href

                if href in seen: continue
                seen.add(href)

                # Description from article paragraphs
                paras = [p.get_text(" ", strip=True) for p in article.select("p") if p.get_text(strip=True)]
                description = " ".join(paras[:3])[:1000] or None

                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                               "description": description})

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"downstageleft:{it['href']}:{it['date']}",
                type="theatre",
                ticket_status="available",
                description=it["description"],
            ))

        return shows
