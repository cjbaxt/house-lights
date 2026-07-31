"""
Garage Noord — Amsterdam club/music venue.
Events listed at garagenoord.com/club — all future events on one page.
No times available from the listing.
"""
import httpx, re
from bs4 import BeautifulSoup
from datetime import date
from .base import BaseScraper, ScrapedShow

CLUB_URL = "https://www.garagenoord.com/club"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_date(day_text: str, month_year_text: str) -> date | None:
    """Parse day ('07') + month+year ('August, 2026') into a date."""
    try:
        day = int(day_text.strip())
    except ValueError:
        return None
    # "August, 2026" or "August 2026"
    parts = re.sub(r"[,]", "", month_year_text.strip()).split()
    if len(parts) < 2:
        return None
    month = MONTHS.get(parts[0].lower())
    if not month:
        return None
    try:
        return date(int(parts[1]), month, day)
    except ValueError:
        return None


class GarageNoordScraper(BaseScraper):
    key = "garagenoord"

    async def scrape(self) -> list[ScrapedShow]:
        today = date.today()
        shows: list[ScrapedShow] = []
        seen: set[str] = set()

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(CLUB_URL)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            for card in soup.select("div.event"):
                day_el = card.select_one(".event__date a")
                month_el = card.select_one(".event__info__meta__date a")
                title_el = card.select_one(".event__title a")
                ticket_el = card.select_one(".event__info__meta__tickets")

                if not (day_el and month_el and title_el):
                    continue

                event_date = _parse_date(day_el.get_text(strip=True), month_el.get_text(strip=True))
                if not event_date or event_date < today:
                    continue

                title = title_el.get_text(" ", strip=True)
                url = title_el.get("href", "")
                if not url:
                    continue

                # Use ticket URL if available (weticket.io), otherwise event page
                ticket_url = ticket_el.get("href") if ticket_el else None
                final_url = ticket_url or url

                source_id = f"garagenoord:{url.rstrip('/').split('/')[-1]}:{event_date.isoformat()}"
                if source_id in seen:
                    continue
                seen.add(source_id)

                shows.append(ScrapedShow(
                    title=title,
                    date=event_date,
                    url=final_url,
                    source_id=source_id,
                    type="music",
                ))

        return sorted(shows, key=lambda s: s.date)
