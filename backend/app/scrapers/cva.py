"""
Conservatorium van Amsterdam — static HTML.
Events as div.agenda-list-event; text format "DD.MM.YY, HH:MM uur\\nTitle\\nVenue"
Shows take place at many venues in and around Amsterdam.
"""
import logging
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

logger = logging.getLogger(__name__)

AGENDA_URL = "https://www.conservatoriumvanamsterdam.nl/agenda/"
BASE_URL = "https://www.conservatoriumvanamsterdam.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

# "14.09.26, 18:00 uur"
DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{2}),\s*(\d{1,2}):(\d{2})\s*uur", re.I)


def _parse(text):
    m = DATE_RE.search(text)
    if not m:
        return None, None
    day, month, yr, hour, minute = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))
    try:
        d = date(2000 + yr, month, day)
        return d, time(hour, minute)
    except ValueError:
        return None, None


class CVAScraper(BaseScraper):
    key = "cva"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            items = []
            seen = set()
            today = date.today()

            for card in soup.select("div.agenda-list-event"):
                link_el = card.select_one("a[href]")
                if not link_el:
                    continue
                href = link_el.get("href", "")
                # Only include CvA-hosted events (internal hrefs)
                if not href.startswith("/agenda/"):
                    continue
                if href in seen:
                    continue
                seen.add(href)

                url = BASE_URL + href
                text = card.get_text(" ", strip=True)
                d, tm = _parse(text)
                if not d or d < today:
                    continue

                # aria-label is cleaner than innerText parsing for title
                title = link_el.get("aria-label", "").strip()
                if not title:
                    # Strip the date prefix and venue suffix from text
                    title = DATE_RE.sub("", text).strip()
                    title = re.sub(r"\s{2,}", " ", title)[:80]
                if not title:
                    continue

                # Third line of text is the venue name
                lines = [l.strip() for l in card.get_text("\n", strip=True).split("\n") if l.strip()]
                venue_name = lines[2] if len(lines) >= 3 else None
                # Strip sub-location suffix (e.g. "Bernard Haitinkzaal, Conservatorium van Amsterdam")
                if venue_name and "," in venue_name:
                    venue_name = venue_name.split(",", 1)[1].strip() or venue_name.split(",", 1)[0].strip()

                img_el = card.select_one("img")
                image_url = img_el.get("src") if img_el else None
                if image_url and image_url.startswith("/"):
                    image_url = BASE_URL + image_url

                items.append({"title": title, "date": d, "time": tm, "url": url, "href": href,
                               "venue_name": venue_name, "image_url": image_url})

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
                        el = ds.select_one(".event-description, .description, .content, main p")
                        if el:
                            t = el.get_text(" ", strip=True)[:1000]
                            if t:
                                return url, t
                except Exception as e:
                    logger.warning("cva desc error %s: %s", url, e)
                return url, None

            unique_urls = list({it["url"] for it in items})
            desc_results = await asyncio.gather(*[fetch_desc(u) for u in unique_urls])
            descriptions = dict(desc_results)

        return [
            ScrapedShow(
                title=it["title"], date=it["date"], time=it["time"], url=it["url"],
                source_id=f"cva:{it['href']}",
                type="classical",
                ticket_status="available",
                venue_name=it["venue_name"],
                description=descriptions.get(it["url"]),
                image_url=it.get("image_url"),
            )
            for it in items
        ]
