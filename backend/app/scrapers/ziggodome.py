"""
Ziggo Dome — public REST JSON API.
GET /api/agenda/aankomend/?limit=50&offset=N

Images: API returns Azure Blob SAS URLs which expire. When the SAS token is
expired (se= date in the past), we fall back to Deezer's public artist search
API (no auth required) to get a 1000×1000 artist photo.
"""
import httpx
import asyncio
import re
from datetime import date, datetime, time, timezone
from html import unescape
from urllib.parse import urlparse, parse_qs
from .base import BaseScraper, ScrapedShow

_HTML_TAG_RE = re.compile(r"<[^>]*>")

API_URL = "https://www.ziggodome.nl/api/agenda/aankomend/"
BASE_URL = "https://www.ziggodome.nl"
DEEZER_SEARCH = "https://api.deezer.com/search/artist"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; house-lights-scraper)",
           "Accept": "application/json"}

SAS_EXPIRY_RE = re.compile(r"[?&]se=([^&]+)")


def _sas_valid(sas_url: str) -> bool:
    """Return True if the SAS token expiry (se=) is in the future."""
    m = SAS_EXPIRY_RE.search(sas_url)
    if not m:
        return False
    try:
        expiry = datetime.fromisoformat(m.group(1).replace("%3A", ":"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return expiry > datetime.now(timezone.utc)
    except ValueError:
        return False


async def _deezer_image(client: httpx.AsyncClient, artist: str) -> str | None:
    """Look up artist on Deezer and return picture_xl URL, or None."""
    await asyncio.sleep(0.25)
    try:
        r = await client.get(
            DEEZER_SEARCH,
            params={"q": artist, "limit": 1},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8,
        )
        if r.status_code == 200:
            data = r.json().get("data", [])
            if data:
                return data[0].get("picture_xl") or data[0].get("picture_big")
    except Exception:
        pass
    return None


class ZiggoDomeScraper(BaseScraper):
    key = "ziggodome"

    async def scrape(self) -> list[ScrapedShow]:
        raw_events: list[dict] = []
        today = date.today()
        offset = 0
        limit = 50

        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
            # Collect all events first
            while True:
                r = await client.get(API_URL, params={"limit": limit, "offset": offset})
                r.raise_for_status()
                body = r.json()
                events = body.get("data", [])
                if not events:
                    break
                raw_events.extend(events)
                if not body.get("pagination", {}).get("hasMore"):
                    break
                offset += limit

            # Identify artists needing Deezer fallback
            deezer_needed: set[str] = set()
            for evt in raw_events:
                sas = (evt.get("artistImage") or {}).get("assetFileSas", "")
                if not sas or not _sas_valid(sas):
                    title = (evt.get("performerName") or "").strip()
                    if title:
                        deezer_needed.add(title)

            # Fetch Deezer images sequentially to avoid rate limiting
            deezer_cache: dict[str, str | None] = {}
            for artist in deezer_needed:
                deezer_cache[artist] = await _deezer_image(client, artist)

        shows: list[ScrapedShow] = []
        for evt in raw_events:
            raw_date = evt.get("showDate", "")
            try:
                dt = datetime.fromisoformat(raw_date)
                d = dt.date()
                tm = time(dt.hour, dt.minute)
            except ValueError:
                continue
            if d < today:
                continue

            title = (evt.get("performerName") or "").strip()
            if not title:
                continue

            ticket_url = evt.get("salesUrl") or ""
            event_id = evt.get("eventId") or evt.get("id") or ""
            url = ticket_url or f"{BASE_URL}/agenda/"
            sold_out = (evt.get("showState") or "").lower() in ("soldout", "sold out")

            # Image: prefer valid SAS, fall back to Deezer
            sas = (evt.get("artistImage") or {}).get("assetFileSas", "")
            if sas and _sas_valid(sas):
                image_url = sas
            else:
                image_url = deezer_cache.get(title)

            raw_desc = evt.get("description") or ""
            description: str | None = None
            if raw_desc:
                description = unescape(_HTML_TAG_RE.sub(" ", raw_desc)).strip()
                description = re.sub(r"\s{2,}", " ", description) or None

            shows.append(ScrapedShow(
                title=title, date=d, time=tm, url=url,
                source_id=f"ziggodome:{event_id}",
                type="music",
                ticket_status="sold_out" if sold_out else "available",
                image_url=image_url,
                description=description,
            ))

        return shows
