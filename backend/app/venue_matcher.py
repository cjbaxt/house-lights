"""
Utility for matching an external venue name to a Venue record in the DB,
creating a new one if none is found.

Used by the Ticketmaster scraper (and any future multi-venue sources).
"""
import re
import uuid
from sqlmodel import Session, select
from app.models.core import Venue, City


def _norm(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[''`]", "", name)
    name = re.sub(r"[^a-z0-9\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    for noise in ("theater", "theatre", "the ", "amsterdam"):
        name = name.replace(noise, "").strip()
    return name


def get_or_create_venue(session: Session, name: str, city_slug: str = "amsterdam") -> uuid.UUID:
    """
    Return the venue_id for `name`, creating a minimal Venue record if needed.
    Matching is case-insensitive and strips common noise words.
    """
    city = session.exec(select(City).where(City.slug == city_slug)).first()
    if city is None:
        raise ValueError(f"City with slug '{city_slug}' not found in DB")

    target = _norm(name)
    venues = session.exec(select(Venue).where(Venue.city_id == city.id)).all()
    for v in venues:
        if _norm(v.name) == target:
            return v.id

    new_venue = Venue(
        name=name.strip(),
        city_id=city.id,
        priority="low",
        active=True,
    )
    session.add(new_venue)
    session.flush()
    return new_venue.id
