"""
Bostheater (Amsterdamse Bos) — WordPress site, static HTML.
Events as article elements with /events/ links.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

HOME_URL = "https://www.bostheater.nl"
BASE_URL = "https://bostheater.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

MONTHS_NL = {"januari":1,"februari":2,"maart":3,"april":4,"mei":5,"juni":6,
              "juli":7,"augustus":8,"september":9,"oktober":10,"november":11,"december":12,
              "jan":1,"feb":2,"mrt":3,"apr":4,"mei":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"okt":10,"nov":11,"dec":12}
DATE_RE = re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")


def _parse(text):
    m = DATE_RE.search(text)
    if not m: return None, None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month: return None, None
    try:
        d = date(int(m.group(3)), month, int(m.group(1)))
        t = TIME_RE.search(text)
        return d, time(int(t.group(1)), int(t.group(2))) if t else None
    except ValueError:
        return None, None


class BostheaterScraper(BaseScraper):
    key = "bostheater"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(HOME_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen = set()

            for article in soup.select("article"):
                link_el = next(
                    (a for a in article.find_all("a", href=True) if "/events/" in a.get("href", "")),
                    None,
                )
                if not link_el: continue
                href = link_el.get("href", "")
                if href in seen: continue
                seen.add(href)
                url = href if href.startswith("http") else BASE_URL + href

                text = article.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < date.today(): continue

                title_el = article.select_one("h2, h3, h4, [class*='title']")
                title = title_el.get_text(strip=True) if title_el else link_el.get_text(strip=True)
                if not title: continue

                cancelled = "geannuleerd" in text.lower() or "afgelast" in text.lower()
                if cancelled: continue

                img_el = article.select_one("img[src]")
                image_url = img_el.get("src") if img_el else None

                items.append({
                    "title": title, "date": d, "time": tm,
                    "url": url, "href": href, "image_url": image_url,
                })

            async def fetch_desc(url: str) -> tuple[str, str | None]:
                try:
                    r = await client.get(url, timeout=15)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        for p in ds.find_all("p"):
                            txt = p.get_text(strip=True)
                            if len(txt) > 80:
                                return url, txt[:1000]
                except Exception:
                    pass
                return url, None

            desc_results = await asyncio.gather(*[fetch_desc(it["url"]) for it in items])
            descriptions = dict(desc_results)

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"bostheater:{it['href']}",
                type="theatre",
                ticket_status="available",
                image_url=it["image_url"],
                description=descriptions.get(it["url"]),
            ))

        return shows
