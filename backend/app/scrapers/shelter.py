"""
Shelter Amsterdam — WordPress portfolio-based site.
Events as article.dt_portfolio with date like "Friday 26.06 23:00 - 06:00"
"""
import httpx, re, asyncio
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
            items = []

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

                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href})

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
                        el = ds.select_one(".entry-content, .post-content, .dt-post-content, main p")
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
                source_id=f"shelter:{it['href']}",
                type="music",
                ticket_status="available",
                description=descriptions.get(it["url"]),
            ))

        return shows
