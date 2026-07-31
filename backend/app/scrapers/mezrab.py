"""
Mezrab — The House of Stories, Amsterdam.
Spoken word, storytelling, open mic, poetry slam.
Uses Events Manager plugin (em-event cards, paginated monthly list).
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow, infer_type

BASE_URL = "https://mezrab.nl"
EVENTS_URL = "https://mezrab.nl/events/"
MAX_PAGES = 8

# "Fri 31.07" — day-of-week + day.month
DATE_RE = re.compile(r"\d{2}\.\d{2}")
TIME_RE = re.compile(r"(\d{2}):(\d{2})")

MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def _parse_date(date_text: str, year_month_map: dict[int, int]) -> date | None:
    """Parse 'Fri 31.07' using year_month_map {month: year} built from h2 headings."""
    m = DATE_RE.search(date_text)
    if not m:
        return None
    day_str, month_str = m.group().split(".")
    day, month = int(day_str), int(month_str)
    year = year_month_map.get(month)
    if not year:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_time(time_text: str) -> time | None:
    m = TIME_RE.search(time_text)
    if not m:
        return None
    try:
        return time(int(m.group(1)), int(m.group(2)))
    except ValueError:
        return None


def _build_year_map(soup: BeautifulSoup) -> dict[int, int]:
    """Build {month_number: year} from h2 group headings like 'Jul 2026'."""
    result = {}
    for h2 in soup.select(".em-events-list-grouped > h2"):
        parts = h2.get_text(strip=True).split()
        if len(parts) == 2:
            month_abbr, year_str = parts
            month = MONTHS.get(month_abbr[:3].capitalize())
            if month and year_str.isdigit():
                result[month] = int(year_str)
    return result


class MezrabScraper(BaseScraper):
    key = "mezrab"

    async def scrape(self) -> list[ScrapedShow]:
        shows: list[ScrapedShow] = []
        seen: set[str] = set()
        today = date.today()

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for page in range(1, MAX_PAGES + 1):
                url = EVENTS_URL if page == 1 else f"{EVENTS_URL}?page={page}"
                resp = await client.get(url)
                if resp.status_code != 200:
                    break
                soup = BeautifulSoup(resp.text, "html.parser")
                year_map = _build_year_map(soup)

                cards = soup.select("div.em-event.em-item")
                if not cards:
                    break

                for card in cards:
                    title_el = card.select_one("h3.em-item-title a")
                    if not title_el:
                        continue
                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    if not href:
                        continue

                    date_el = card.select_one(".em-event-date")
                    time_el = card.select_one(".em-event-time")
                    img_el = card.select_one(".em-item-image img")
                    desc_el = card.select_one(".em-item-desc")

                    event_date = _parse_date(date_el.get_text(strip=True) if date_el else "", year_map)
                    if not event_date or event_date < today:
                        continue

                    event_time = _parse_time(time_el.get_text(strip=True) if time_el else "")
                    source_id = f"mezrab:{href.rstrip('/').split('/')[-1]}:{event_date.isoformat()}"
                    if source_id in seen:
                        continue
                    seen.add(source_id)

                    description = desc_el.get_text(" ", strip=True) if desc_el else None
                    image_url = img_el.get("src") if img_el else None
                    event_type = infer_type(title, description or "")
                    # Mezrab is primarily spoken word — default to spoken_word if nothing else matches
                    if event_type == "other":
                        event_type = "spoken_word"

                    shows.append(ScrapedShow(
                        title=title,
                        date=event_date,
                        time=event_time,
                        url=href,
                        source_id=source_id,
                        type=event_type,
                        description=description,
                        image_url=image_url,
                    ))

        return sorted(shows, key=lambda s: s.date)
