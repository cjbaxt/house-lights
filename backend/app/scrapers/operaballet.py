"""
Nationale Opera & Ballet scraper.

Flow:
1. Scrape agenda pages to collect unique show URLs, titles, images.
2. For each show, fetch the detail page to get data-node-id.
3. Call /api/1.0/activities/{node_id}/en?limit=100 to get all individual
   performances with exact dates, times, and ticket status.
"""
import httpx
import re
import asyncio
from datetime import date, time as time_type
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapedShow

AGENDA_BASE = "https://www.operaballet.nl/en/agenda"
BASE_URL = "https://www.operaballet.nl"
HEADERS = {"User-Agent": "Mozilla/5.0"}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
# "Saturday 05 September" or "5 September"
PERF_DATE_RE = re.compile(r"(?:\w+\s+)?(\d{1,2})\s+(\w+)", re.IGNORECASE)
# "19:30 hours"
PERF_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")

STATUS_MAP = {
    "available": "available",
    "last-tickets": "few_left",
    "sold-out": "sold_out",
    "sold_out": "sold_out",
}


def _infer_year(day: int, month: int) -> int:
    """Pick the nearest future year for a day/month combination."""
    today = date.today()
    for year in [today.year, today.year + 1]:
        try:
            d = date(year, month, day)
            if d >= today:
                return year
        except ValueError:
            pass
    return today.year + 1


def _parse_perf(entry: dict) -> tuple[date, time_type | None] | None:
    date_str = entry.get("date", "")
    m = PERF_DATE_RE.search(date_str)
    if not m:
        return None
    day = int(m.group(1))
    month = MONTHS.get(m.group(2).lower())
    if not month:
        return None
    year = _infer_year(day, month)
    try:
        d = date(year, month, day)
    except ValueError:
        return None

    t = None
    time_str = entry.get("time", "")
    tm = PERF_TIME_RE.search(time_str)
    if tm:
        t = time_type(int(tm.group(1)), int(tm.group(2)))

    return d, t


class OperaBalletScraper(BaseScraper):
    key = "operaballet"

    async def scrape(self) -> list[ScrapedShow]:
        today = date.today()

        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:

            # Step 1: collect unique show entries from all agenda pages
            show_entries: dict[str, dict] = {}  # url -> {title, image_url, type}

            page_num = 0
            while True:
                resp = await client.get(f"{AGENDA_BASE}?page={page_num}")
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                cards = soup.select("article.programCard")
                if not cards:
                    break

                for card in cards:
                    link_el = card.select_one("a[href]")
                    if not link_el:
                        continue
                    href = link_el.get("href", "")
                    url = href if href.startswith("http") else BASE_URL + href
                    if url in show_entries:
                        continue

                    title = card.get("data-datalayer-item-name", "").strip()
                    if not title:
                        h = card.select_one("h2, h3, h4")
                        title = h.get_text(strip=True) if h else ""
                    if not title:
                        continue

                    category = card.get("data-datalayer-item-category", "").lower()
                    event_type = "ballet" if "ballet" in category else "opera" if "opera" in category else "dance"

                    img_el = card.select_one("picture img[src]")
                    image_url = img_el["src"] if img_el else None
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url

                    show_entries[url] = {
                        "title": title,
                        "image_url": image_url,
                        "type": event_type,
                    }

                if not soup.select_one("a[rel='next']"):
                    break
                page_num += 1

            # Step 2: fetch detail pages to get node_id and sub-venue labels, in parallel
            async def fetch_detail(url: str) -> tuple[str, str | None, str | None]:
                try:
                    r = await client.get(url, timeout=20)
                    if r.status_code == 200:
                        s = BeautifulSoup(r.text, "html.parser")
                        container = s.select_one("[data-node-id]")
                        node_id = container.get("data-node-id") if container else None
                        # Only use place labels that refer to halls within the NOB building.
                        # Touring shows list external theatres here which would mislead.
                        NOB_HALLS = {"grote zaal", "kleine zaal", "orkestzaal", "rabozaal", "jurriaanse zaal", "boekmanzaal"}
                        places = list(dict.fromkeys(
                            p.get_text(strip=True) for p in s.select(".card-large__place")
                            if p.get_text(strip=True).lower() in NOB_HALLS
                        ))
                        subtitle = " / ".join(places) if places else None
                        meta = s.select_one('meta[property="og:description"], meta[name="description"]')
                        description = meta.get("content", "").strip() if meta else None
                        if description and "Unfortunately" in description:
                            description = None
                        return url, node_id, subtitle, description
                except Exception:
                    pass
                return url, None, None, None

            detail_results = await asyncio.gather(*[fetch_detail(u) for u in show_entries])
            node_map: dict[str, str] = {}
            subtitle_map: dict[str, str | None] = {}
            desc_map: dict[str, str | None] = {}
            for u, nid, sub, desc in detail_results:
                if nid:
                    node_map[u] = nid
                subtitle_map[u] = sub
                desc_map[u] = desc

            # Step 3: fetch performances for each show, in parallel
            async def fetch_performances(url: str, node_id: str) -> tuple[str, list]:
                api_url = f"{BASE_URL}/api/1.0/activities/{node_id}/en?limit=100"
                try:
                    r = await client.get(api_url, timeout=20)
                    if r.status_code == 200:
                        data = r.json()
                        return url, data.get("results", [])
                except Exception:
                    pass
                return url, []

            perf_results = await asyncio.gather(*[
                fetch_performances(u, nid) for u, nid in node_map.items()
            ])
            perf_map: dict[str, list] = dict(perf_results)

        # Build ScrapedShow entries
        shows: list[ScrapedShow] = []
        seen: set[str] = set()

        for url, info in show_entries.items():
            performances = perf_map.get(url, [])

            if not performances:
                continue

            for perf in performances:
                parsed = _parse_perf(perf)
                if not parsed:
                    continue
                d, t = parsed
                if d < today:
                    continue

                ticket_status = STATUS_MAP.get(perf.get("status", ""), "available")

                source_id = f"operaballet:{url}:{d.isoformat()}"
                if source_id in seen:
                    continue
                seen.add(source_id)

                shows.append(ScrapedShow(
                    title=info["title"],
                    subtitle=subtitle_map.get(url),
                    description=desc_map.get(url),
                    date=d,
                    time=t,
                    url=url,  # always use the show detail page, not the shop basket link
                    source_id=source_id,
                    type=info["type"],
                    ticket_status=ticket_status,
                    image_url=info["image_url"],
                ))

        return shows
