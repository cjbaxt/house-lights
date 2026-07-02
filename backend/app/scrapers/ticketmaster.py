"""
Ticketmaster Discovery API — Amsterdam events.

Standalone scraper: fetches all upcoming Amsterdam events, resolves each to a
Venue record (creating one if missing), and writes directly to the DB.
Does NOT go through the standard run_scrapers venue/company loop.

Requires env var: TICKETMASTER_API_KEY
Get a free key at https://developer.ticketmaster.com/

Rate limit: 5 req/s, 5,000 req/day on free tier.

Run: python -m app.scrapers.ticketmaster
"""
import os
import re
import asyncio
from datetime import date, datetime, time as time_type
import httpx
from sqlmodel import Session, select
from app.db import engine
from app.models.core import Show, Watchlist
from app.venue_matcher import get_or_create_venue

API_BASE = "https://app.ticketmaster.com/discovery/v2"

# Venues we already have dedicated scrapers for — skip to avoid duplication.
# Checked as case-insensitive substrings of the TM venue name.
SCRAPED_VENUES = [
    "paradiso", "melkweg", "ziggo dome", "afas live",
    "royal concertgebouw", "concertgebouw", "bimhuis", "muziekgebouw",
    "carré", "carre", "theater carré", "boom chicago", "felix meritis",
    "frascati", "meervaart", "delamar", "de lamar", "shelter",
    "ot301", "internationaal theater amsterdam", "nationale opera",
    "muziektheater",
]

TM_TYPE_MAP = {
    "Music": "music",
    "Arts & Theatre": "theatre",
    "Comedy": "comedy",
    "Dance": "dance",
    "Sports": "other",
    "Film": "other",
    "Family": "other",
}


def _should_skip(venue_name: str) -> bool:
    vl = venue_name.lower()
    return any(k in vl for k in SCRAPED_VENUES)


def _is_short_url(url: str) -> bool:
    # ticketmaster.com/event/ALPHANUMERIC — internal format, doesn't resolve publicly
    return bool(re.match(r"https://www\.ticketmaster\.com/event/[A-Z0-9_]+$", url))


def _event_type(classifications: list) -> str:
    for cl in classifications:
        genre = cl.get("genre", {}).get("name", "")
        if genre == "Ballet":
            return "dance"
        seg = cl.get("segment", {}).get("name", "")
        if seg in TM_TYPE_MAP:
            return TM_TYPE_MAP[seg]
    return "music"


def _best_image(images: list) -> str | None:
    ranked = sorted(
        [i for i in images if i.get("url")],
        key=lambda i: (i.get("ratio") == "16_9", i.get("width", 0)),
        reverse=True,
    )
    return ranked[0]["url"] if ranked else None


def _base_title(t: str) -> str:
    for sep in [" | VIP", " | vip"]:
        if sep in t:
            return t.split(sep)[0].strip().lower()
    return t.strip().lower()


async def fetch_events() -> list[dict]:
    """Fetch all upcoming Amsterdam events from TM API."""
    api_key = os.environ.get("TICKETMASTER_API_KEY", "")
    if not api_key:
        raise RuntimeError("TICKETMASTER_API_KEY env var not set")

    today = date.today()
    all_events: list[dict] = []
    page = 0

    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            resp = await client.get(
                f"{API_BASE}/events.json",
                params={
                    "apikey": api_key,
                    "city": "Amsterdam",
                    "countryCode": "NL",
                    "size": 200,
                    "page": page,
                    "sort": "date,asc",
                    "startDateTime": f"{today.isoformat()}T00:00:00Z",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            events = data.get("_embedded", {}).get("events") or []
            if not events:
                break
            all_events.extend(events)
            total_pages = data.get("page", {}).get("totalPages", 1)
            page += 1
            if page >= total_pages:
                break
            await asyncio.sleep(0.3)

    return all_events


def _is_vip(title: str) -> bool:
    return bool(re.search(r"\|\s*VIP|\|\s*upgrade", title, re.I))


def parse_events(raw_events: list[dict]) -> list[dict]:
    """Parse raw TM events into dicts ready for DB insertion."""
    today = date.today()
    candidates: list[dict] = []

    for evt in raw_events:
        venues = evt.get("_embedded", {}).get("venues") or []
        venue_name = venues[0].get("name", "") if venues else ""
        if not venue_name or _should_skip(venue_name):
            continue

        title = evt.get("name", "").strip()
        if not title:
            continue

        url = evt.get("url", "")
        if _is_short_url(url):
            continue

        dates_obj = evt.get("dates", {})
        start = dates_obj.get("start", {})
        local_date = start.get("localDate", "")
        if not local_date:
            continue
        try:
            d = date.fromisoformat(local_date)
        except ValueError:
            continue
        if d < today:
            continue

        status_code = dates_obj.get("status", {}).get("code", "")
        if status_code in ("cancelled", "postponed"):
            continue

        local_time = start.get("localTime", "")
        tba = start.get("timeTBA") or start.get("noSpecificTime")
        tm: time_type | None = None
        if local_time and not tba:
            try:
                parts = local_time.split(":")
                tm = time_type(int(parts[0]), int(parts[1]))
            except (ValueError, IndexError):
                pass

        info = evt.get("info") or evt.get("pleaseNote") or ""
        # Strip TM boilerplate that leaks into AI summaries
        info = re.sub(r"(?i)this is a mobile[\s\-]?only (event|show)[^.]*\.", "", info).strip()
        description = info.strip() or None
        if not description:
            atts = evt.get("_embedded", {}).get("attractions") or []
            if atts:
                description = (atts[0].get("description") or "").strip() or None

        candidates.append({
            "title": title,
            "date": d,
            "time": tm,
            "url": evt.get("url", ""),
            "source_id": f"ticketmaster:{evt.get('id', title)}",
            "type": _event_type(evt.get("classifications", [])),
            "ticket_status": "sold_out" if status_code == "offsale" else "available",
            "image_url": _best_image(evt.get("images", [])),
            "description": description,
            "venue_name": venue_name,
            "_vip": _is_vip(title),
        })

    # Dedup by (venue, date, base_title): prefer non-VIP, then longer title
    dedup: dict[tuple, dict] = {}
    for c in candidates:
        key = (c["venue_name"].lower(), c["date"], _base_title(c["title"]))
        existing = dedup.get(key)
        if existing is None:
            dedup[key] = c
        elif existing["_vip"] and not c["_vip"]:
            dedup[key] = c  # replace VIP with real listing

    return [{k: v for k, v in c.items() if k != "_vip"} for c in dedup.values()]


def sync_to_db(parsed: list[dict]) -> tuple[int, int, int]:
    """Upsert parsed events into the DB, creating venues as needed."""
    inserted = updated = removed = 0

    with Session(engine) as session:
        new_source_ids = {p["source_id"] for p in parsed}

        # Collect all venue_ids used by TM shows so we can scope removals
        existing_tm = session.exec(
            select(Show).where(Show.source_id.startswith("ticketmaster:"))
        ).all()
        for show in existing_tm:
            if show.source_id not in new_source_ids:
                for wl in session.exec(
                    select(Watchlist).where(Watchlist.show_id == show.id)
                ).all():
                    session.delete(wl)
                session.flush()
                session.delete(show)
                removed += 1

        for p in parsed:
            venue_id = get_or_create_venue(session, p["venue_name"])

            existing = session.exec(
                select(Show).where(Show.source_id == p["source_id"])
            ).first()

            if existing:
                existing.title = p["title"]
                existing.url = p["url"]
                existing.time = p["time"]
                existing.ticket_status = p["ticket_status"]
                existing.image_url = p["image_url"]
                existing.venue_id = venue_id
                if p["description"]:
                    existing.description = p["description"]
                session.add(existing)
                updated += 1
            else:
                session.add(Show(
                    title=p["title"],
                    date=p["date"],
                    time=p["time"],
                    url=p["url"],
                    source_id=p["source_id"],
                    type=p["type"],
                    ticket_status=p["ticket_status"],
                    image_url=p["image_url"],
                    description=p["description"],
                    venue_id=venue_id,
                ))
                inserted += 1

        session.commit()

    return inserted, updated, removed


async def run():
    from dotenv import load_dotenv
    load_dotenv()

    print("Fetching Amsterdam events from Ticketmaster...")
    raw = await fetch_events()
    print(f"  {len(raw)} raw events")
    parsed = parse_events(raw)
    print(f"  {len(parsed)} after dedup/filter")
    ins, upd, rem = sync_to_db(parsed)
    print(f"  inserted {ins}, updated {upd}, removed {rem}")


if __name__ == "__main__":
    asyncio.run(run())
