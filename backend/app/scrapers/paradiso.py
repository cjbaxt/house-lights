"""
Paradiso — calls their internal GraphQL API directly (no Playwright needed).
The API is at AWS API Gateway; paginated via searchAfter cursor.
Covers Paradiso main + Zonnehuis sub-venue.
"""
import httpx
import re
from datetime import date, time, datetime, timezone
from html import unescape
from .base import BaseScraper, ScrapedShow

_HTML_TAG_RE = re.compile(r"<[^>]+>")

API_URL = "https://knwxh8dmh1.execute-api.eu-central-1.amazonaws.com/graphql"
BASE_URL = "https://www.paradiso.nl"

QUERY = """
  query programItemsQuery(
    $site: String
    $size: Int
    $gteStartDateTime: String
    $searchAfter: [String]
  ) {
    program(
      site: $site
      size: $size
      gteStartDateTime: $gteStartDateTime
      searchAfter: $searchAfter
    ) {
      events {
        id uri title startDateTime date sort
        eventStatus soldOut
        text
        image { desktop2x }
        location { id title }
      }
    }
  }
"""

TIME_RE = re.compile(r"T(\d{2}):(\d{2}):")
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://www.paradiso.nl",
    "Referer": "https://www.paradiso.nl/",
    "User-Agent": "Mozilla/5.0",
}


def _location_title(loc) -> str:
    if isinstance(loc, dict):
        return loc.get("title", "")
    if isinstance(loc, list) and loc:
        return loc[0].get("title", "") if isinstance(loc[0], dict) else ""
    return ""


class ParadisoScraper(BaseScraper):
    key = "paradiso"

    async def scrape(self) -> list[ScrapedShow]:
        today = date.today()
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        all_events = []
        search_after = None

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                variables = {
                    "site": "paradisoNederlands",
                    "size": 100,
                    "gteStartDateTime": now,
                    "searchAfter": search_after,
                }
                resp = await client.post(
                    API_URL,
                    json={"query": QUERY, "variables": variables},
                    headers=HEADERS,
                )
                resp.raise_for_status()
                events = resp.json().get("data", {}).get("program", {}).get("events") or []
                if not events:
                    break
                all_events.extend(events)
                if len(events) < 100:
                    break
                search_after = events[-1].get("sort")

        shows = []
        for evt in all_events:
            raw_date = evt.get("date") or ""
            try:
                d = date.fromisoformat(raw_date)
            except ValueError:
                continue
            if d < today:
                continue

            if evt.get("eventStatus") == "cancelled":
                continue

            title = (evt.get("title") or "").strip()
            if not title:
                continue

            href = evt.get("uri", "")
            url = BASE_URL + "/" + href.lstrip("/") if href else BASE_URL

            sold_out = evt.get("soldOut") == "yes"

            start = evt.get("startDateTime", "")
            tm = None
            m = TIME_RE.search(start)
            if m:
                try:
                    tm = time(int(m.group(1)), int(m.group(2)))
                except ValueError:
                    pass

            raw_text = evt.get("text") or ""
            description: str | None = None
            if raw_text:
                description = unescape(_HTML_TAG_RE.sub(" ", raw_text)).strip()
                description = re.sub(r"\s{2,}", " ", description) or None

            images = evt.get("image") or []
            image_url: str | None = None
            # Prefer the largest image (desktop2x from the card-sized entry, index 4)
            for img in images:
                candidate = img.get("desktop2x") or img.get("desktop")
                if candidate:
                    image_url = candidate
                    break

            shows.append(ScrapedShow(
                title=title, date=d, time=tm, url=url,
                source_id=f"paradiso:{href}",
                type="music",
                ticket_status="sold_out" if sold_out else "available",
                description=description,
                image_url=image_url,
            ))

        return shows
