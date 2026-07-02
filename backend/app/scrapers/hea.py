"""
HEA Productions (Het Engels Amateurtheater Amsterdam) — simple static site.
Shows listed as article elements with "Month DD-DD, YYYY" date format.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

HOME_URL = "https://www.heaproductions.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
           "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
           "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\w+)\s+(\d{1,2})(?:-\d{1,2})?,?\s+(\d{4})", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None
    month = MONTHS.get(m.group(1).lower())
    if not month: return None
    try:
        return date(int(m.group(3)), month, int(m.group(2)))
    except ValueError:
        return None


class HEAScraper(BaseScraper):
    key = "hea"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(HOME_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []

            for article in soup.select("article"):
                text = article.get_text(" ", strip=True)
                d = _parse(text)
                if not d or d < date.today(): continue

                title_el = article.select_one("h1, h2, h3")
                title = title_el.get_text(strip=True) if title_el else re.sub(DATE_RE, "", text).strip()[:80]
                if not title: continue

                link_el = article.select_one("a[href]")
                href = link_el.get("href", "") if link_el else ""
                url = href if href.startswith("http") else HOME_URL + href

                img_el = article.select_one("img[src]")
                image_url = img_el.get("src") if img_el else None

                items.append({
                    "title": title, "date": d, "url": url,
                    "href": href, "image_url": image_url,
                })

            async def fetch_desc(url: str) -> tuple[str, str | None]:
                if not url or url == HOME_URL:
                    return url, None
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        for p in ds.find_all("p"):
                            txt = p.get_text(strip=True)
                            if len(txt) > 40:
                                return url, txt[:1000]
                except Exception:
                    pass
                return url, None

            desc_results = await asyncio.gather(*[fetch_desc(it["url"]) for it in items])
            descriptions = dict(desc_results)

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"], date=it["date"], url=it["url"],
                source_id=f"hea:{it['href'] or it['title']}:{it['date']}",
                type="theatre",
                ticket_status="available",
                image_url=it["image_url"],
                description=descriptions.get(it["url"]),
            ))

        return shows
