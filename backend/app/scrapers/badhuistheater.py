"""
Badhuistheater (Mike's Badhuis) - WordPress site.
Each event card is a single <a class="event-thumb"> wrapping image, h3 title,
date divs, and description paragraphs.
"""
import httpx
import re
from datetime import date, time
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapedShow

AGENDA_URL = "https://www.badhuistheater.nl/agenda/"
BASE_URL = "https://www.badhuistheater.nl"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)"}

DATE_RE = re.compile(r"(\d{1,2})\s*/\s*(\d{2})\s*/\s*(\d{4})")
TIME_RE = re.compile(r"-\s*(\d{1,2}):(\d{2})")


def _parse_date_str(s: str) -> tuple[date, time | None] | None:
    dm = DATE_RE.search(s)
    if not dm:
        return None
    try:
        d = date(int(dm.group(3)), int(dm.group(2)), int(dm.group(1)))
    except ValueError:
        return None
    tm_match = TIME_RE.search(s)
    tm = time(int(tm_match.group(1)), int(tm_match.group(2))) if tm_match else None
    return d, tm


def _clean_title(raw: str) -> str:
    raw = re.sub(r'[\u201c\u201d\u2018\u2019\u2013\u2014"\'.\.]+', '', raw, flags=re.I)
    raw = re.sub(r'\s*(is\s+)?(SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED).*', '', raw, flags=re.I)
    return raw.strip()


class BadhuistheaterScraper(BaseScraper):
    key = "badhuistheater"

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        today = date.today()
        shows: list[ScrapedShow] = []
        seen_source_ids: set[str] = set()

        for card in soup.select("a.event-thumb"):
            href = card.get("href", "").strip()
            if not href or href == "#":
                continue
            url = href if href.startswith("http") else BASE_URL + href

            # Skip cancelled
            full_text = card.get_text(" ", strip=True).lower()
            if "cancelled" in full_text or "afgelast" in full_text:
                continue

            # Title from <h3>
            h3 = card.select_one("h3")
            if not h3:
                continue
            title = _clean_title(h3.get_text(strip=True))
            if not title:
                continue

            # Image
            img = card.select_one("img")
            image_url = img.get("src") if img else None

            # Description from <p> tags
            paras = [p.get_text(strip=True) for p in card.select(".clm.title p") if p.get_text(strip=True)]
            description = " ".join(paras) or None

            # Each .date div is a separate performance
            date_divs = card.select(".date")
            if not date_divs:
                continue

            for div in date_divs:
                parsed = _parse_date_str(div.get_text(strip=True))
                if not parsed:
                    continue
                d, tm = parsed
                if d < today:
                    continue

                source_id = f"badhuistheater:{href}:{d.isoformat()}"
                if source_id in seen_source_ids:
                    continue
                seen_source_ids.add(source_id)

                shows.append(ScrapedShow(
                    title=title,
                    date=d,
                    time=tm,
                    url=url,
                    source_id=source_id,
                    type="theatre",
                    ticket_status="sold_out" if "sold out" in full_text else "available",
                    image_url=image_url,
                    description=description,
                ))

        return shows
