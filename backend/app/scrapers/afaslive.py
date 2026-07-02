"""
AFAS Live — static HTML agenda + per-event detail pages for times.
Agenda page lists each performance date separately (same href can appear multiple times).
Detail page timetable has buttons like "vr. 04 sep. 20:00" — we match by day+month.
Link classes on agenda: txt-white, soldout, canceled.
"""
import httpx, re, asyncio
from bs4 import BeautifulSoup
from datetime import date, time as time_type
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.afaslive.nl/agenda"
BASE_URL = "https://www.afaslive.nl"

MONTHS_NL = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "augustus": 8,
    "september": 9, "oktober": 10, "november": 11, "december": 12,
}
# Short month abbreviations used in timetable buttons
MONTHS_NL_SHORT = {
    "jan": 1, "feb": 2, "mrt": 3, "apr": 4,
    "mei": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "okt": 10, "nov": 11, "dec": 12,
}
DATE_RE = re.compile(
    r"(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+(\d{1,2})\s+(\w+)\s+(\d{4})",
    re.I,
)
BTN_RE = re.compile(r"(\d{1,2})\s+(\w+)\.?\s*(\d{2}:\d{2})?")
TIME_RE = re.compile(r"(\d{2}):(\d{2})")

COMEDY_WORDS = re.compile(r"\bcomedi|comedian|stand.?up|humor|comedy\b", re.I)
THEATRE_WORDS = re.compile(r"\btheater|theatre|musical|toneel|voorstelling\b", re.I)


def _parse_date(text: str) -> date | None:
    m = DATE_RE.search(text)
    if not m:
        return None
    month = MONTHS_NL.get(m.group(2).lower())
    if not month:
        return None
    try:
        return date(int(m.group(3)), month, int(m.group(1)))
    except ValueError:
        return None


def _parse_timetable(soup: BeautifulSoup) -> dict[tuple[int, int], time_type | None]:
    """Returns {(day, month): time_or_None} from the timetable buttons."""
    result = {}
    for btn in soup.select(".timesTable button"):
        txt = btn.get_text(" ", strip=True)
        m = BTN_RE.search(txt)
        if not m:
            continue
        day = int(m.group(1))
        month = MONTHS_NL_SHORT.get(m.group(2).lower().rstrip("."))
        if not month:
            continue
        t = None
        if m.group(3):
            hh, mm = map(int, m.group(3).split(":"))
            t = time_type(hh, mm)
        result[(day, month)] = t
    return result


def _infer_type(title: str) -> str:
    if COMEDY_WORDS.search(title):
        return "comedy"
    if THEATRE_WORDS.search(title):
        return "theatre"
    return "music"


class AFASLiveScraper(BaseScraper):
    key = "afaslive"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            today = date.today()

            # Pass 1: collect entries from agenda; <label> may contain <time> child
            entries: list[dict] = []
            seen_key: set[tuple] = set()

            for link in soup.select("a.txt-white[href*='/agenda/']"):
                classes = link.get("class", [])
                if "canceled" in classes:
                    continue

                href = link.get("href", "")
                if not href:
                    continue
                url = href if href.startswith("http") else BASE_URL + href

                label = link.select_one("label")
                if not label:
                    continue

                # Time may be a <time> child inside <label>
                time_el = label.select_one("time")
                t: time_type | None = None
                if time_el:
                    tm = TIME_RE.match(time_el.get_text(strip=True))
                    if tm:
                        t = time_type(int(tm.group(1)), int(tm.group(2)))
                    time_el.decompose()  # remove before extracting title text

                title = label.get_text(strip=True)
                if not title or len(title) < 2:
                    continue

                dt_el = link.select_one("datetime")
                d = _parse_date(dt_el.get_text(" ", strip=True)) if dt_el else None
                if not d or d < today:
                    continue

                key = (href, d, t)
                if key in seen_key:
                    continue
                seen_key.add(key)

                img_el = link.select_one("figure img[src]")
                image_url = img_el["src"] if img_el else None
                if image_url and not image_url.startswith("http"):
                    image_url = BASE_URL + image_url

                entries.append({
                    "href": href, "url": url, "title": title,
                    "date": d, "time": t, "sold_out": "soldout" in classes,
                    "image_url": image_url,
                })

            # Pass 2: for entries without a time, try the detail page timetable
            needs_detail = {e["href"] for e in entries if e["time"] is None}

            async def fetch_detail(href: str) -> tuple[str, dict, str | None]:
                detail_url = href if href.startswith("http") else BASE_URL + href
                try:
                    r = await client.get(detail_url, timeout=20)
                    if r.status_code == 200:
                        detail_soup = BeautifulSoup(r.text, "html.parser")
                        timetable = _parse_timetable(detail_soup)
                        meta = detail_soup.select_one('meta[name=description]')
                        desc = meta.get("content", "").strip() if meta else None
                        return href, timetable, desc or None
                except Exception:
                    pass
                return href, {}, None

            results = await asyncio.gather(*[fetch_detail(h) for h in needs_detail])
            timetables: dict[str, dict] = {}
            descriptions: dict[str, str | None] = {}
            for href, timetable, desc in results:
                timetables[href] = timetable
                descriptions[href] = desc

            # Also fetch descriptions for events that already had a time (no detail fetch done yet)
            already_fetched = needs_detail
            needs_desc = {e["href"] for e in entries if e["href"] not in already_fetched}

            async def fetch_desc_only(href: str) -> tuple[str, str | None]:
                detail_url = href if href.startswith("http") else BASE_URL + href
                try:
                    r = await client.get(detail_url, timeout=20)
                    if r.status_code == 200:
                        detail_soup = BeautifulSoup(r.text, "html.parser")
                        meta = detail_soup.select_one('meta[name=description]')
                        desc = meta.get("content", "").strip() if meta else None
                        return href, desc or None
                except Exception:
                    pass
                return href, None

            desc_results = await asyncio.gather(*[fetch_desc_only(h) for h in needs_desc])
            for href, desc in desc_results:
                descriptions[href] = desc

        shows = []
        for e in entries:
            t = e["time"]
            if t is None:
                timetable = timetables.get(e["href"], {})
                t = timetable.get((e["date"].day, e["date"].month))
            time_str = t.strftime("%H%M") if t else ""
            shows.append(ScrapedShow(
                title=e["title"],
                date=e["date"],
                time=t,
                url=e["url"],
                source_id=f"afaslive:{e['href']}:{e['date'].isoformat()}:{time_str}",
                type=_infer_type(e["title"]),
                ticket_status="sold_out" if e["sold_out"] else "available",
                image_url=e["image_url"],
                description=descriptions.get(e["href"]),
            ))

        return shows
