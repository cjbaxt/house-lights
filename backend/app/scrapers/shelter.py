"""
Shelter Amsterdam — WordPress portfolio-based site.
Events as article.dt_portfolio with date like "Friday 26.06 23:00 - 06:00"
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.shelteramsterdam.nl/"
BASE_URL = "https://www.shelteramsterdam.nl"

DATE_RE = re.compile(r"(\w+)\s+(\d{1,2})\.(\d{2})", re.I)
TIME_RE = re.compile(r"(\d{2}):(\d{2})")
MONTHS = {"monday":None,"tuesday":None,"wednesday":None,"thursday":None,
          "friday":None,"saturday":None,"sunday":None}  # day names, not months
# Date is "day DD.MM" — need to infer year
YEAR = date.today().year


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    day_name = m.group(1).lower()
    if day_name not in ("monday","tuesday","wednesday","thursday","friday","saturday","sunday"):
        return None, None
    try:
        month = int(m.group(3))
        day = int(m.group(2))
        year = YEAR
        d = date(year, month, day)
        if d < date.today():
            d = date(year + 1, month, day)
        times = TIME_RE.findall(text)
        tm = time(int(times[0][0]), int(times[0][1])) if times else None
        return d, tm
    except ValueError:
        return None, None


class ShelterScraper(BaseScraper):
    key = "shelter"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows = []

        for article in soup.select("article[class*='dt_portfolio']"):
            link_el = article.select_one("a[href]")
            if not link_el: continue
            href = link_el.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href

            text = article.get_text(" ", strip=True)
            d, tm = _parse(text)
            if not d or d < date.today(): continue

            title_el = article.select_one("h2, h3, .dt-post-title")
            title = title_el.get_text(strip=True) if title_el else text.split("\n")[0][:80]
            if not title: continue

            shows.append(ScrapedShow(
                title=title, date=d, time=tm, url=url,
                source_id=f"shelter:{href}",
                type="music",
                ticket_status="available",
            ))

        return shows
