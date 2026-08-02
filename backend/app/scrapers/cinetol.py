"""
Cinetol — Webflow-based static HTML.
"""
import httpx, re, asyncio, logging
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

logger = logging.getLogger(__name__)

# "doors: show: 17:00" or "aanvang: 20:30" or standalone "20:30"
_SHOW_TIME_RE = re.compile(r"(?:show|aanvang)[:\s]+(\d{1,2}):(\d{2})", re.I)
_TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")

AGENDA_URL = "https://www.cinetol.nl/programma"
BASE_URL = "https://www.cinetol.nl"


def _parse_date(card) -> date | None:
    year = date.today().year
    for el in card.select(".event-tag.filter.hide"):
        t = el.get_text(strip=True)
        if re.match(r"202\d", t):
            year = int(t)
            break

    header = card.select_one(".card_header .event_date-flex")
    if not header:
        return None
    nums = [el.get_text(strip=True) for el in header.children
            if hasattr(el, "get_text") and el.get_text(strip=True).isdigit()]
    if len(nums) < 2:
        return None
    day, month = int(nums[0]), int(nums[1])
    try:
        d = date(year, month, day)
        if d < date.today() and year == date.today().year:
            d = date(year + 1, month, day)
        return d
    except ValueError:
        return None


class CinetolScraper(BaseScraper):
    key = "cinetol"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            items = []
            seen: set[str] = set()

            for card in soup.select("div.card_component"):
                link_el = next(
                    (a for a in card.find_all("a", href=True) if "/events/" in a.get("href", "")),
                    None,
                )
                if not link_el:
                    continue
                href = link_el.get("href", "")
                if href in seen:
                    continue
                seen.add(href)
                url = BASE_URL + href if href.startswith("/") else href

                d = _parse_date(card)
                if not d or d < date.today():
                    continue

                title_el = card.select_one("[fs-list-field='name']")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue

                subtitle_el = card.select_one("[fs-list-field='support']")
                subtitle = subtitle_el.get_text(strip=True) if subtitle_el else None

                img_el = card.select_one("img.card_image")
                image_url = img_el.get("src") if img_el else None

                items.append({
                    "href": href, "url": url, "title": title,
                    "subtitle": subtitle, "date": d, "image_url": image_url,
                })

            # Fetch detail pages in parallel for descriptions and times
            async def fetch_detail(href: str) -> tuple[str, str | None, time | None]:
                detail_url = BASE_URL + href if href.startswith("/") else href
                try:
                    r = await client.get(detail_url, timeout=20)
                    if r.status_code == 200:
                        ds = BeautifulSoup(r.text, "html.parser")
                        desc_el = ds.select_one(".w-richtext")
                        desc = desc_el.get_text(" ", strip=True)[:1000] or None if desc_el else None
                        # Time: "show: HH:MM" preferred, else first time after "doors:"
                        page_text = ds.get_text(" ", strip=True)
                        tm: time | None = None
                        m = _SHOW_TIME_RE.search(page_text)
                        if not m:
                            m = _TIME_RE.search(page_text)
                        if m:
                            try:
                                tm = time(int(m.group(1)), int(m.group(2)))
                            except ValueError:
                                pass
                        return href, desc, tm
                except Exception as e:
                    logger.warning("cinetol detail fetch failed for %s: %s", href, e)
                return href, None, None

            detail_results = await asyncio.gather(*[fetch_detail(it["href"]) for it in items])
            descriptions = {h: d for h, d, _ in detail_results}
            times = {h: t for h, _, t in detail_results}

        shows = []
        for it in items:
            shows.append(ScrapedShow(
                title=it["title"],
                subtitle=it["subtitle"],
                date=it["date"],
                time=times.get(it["href"]),
                url=it["url"],
                source_id=f"cinetol:{it['href']}",
                type="music",
                ticket_status="available",
                image_url=it["image_url"],
                description=descriptions.get(it["href"]),
            ))

        return shows
