"""
Utility for matching an external venue name to a Venue record in the DB,
creating a new one if none is found.

Used by the Ticketmaster scraper (and any future multi-venue sources).
"""
import re
import uuid
from sqlmodel import Session, select
from app.models.core import Venue


# Normalise a name for fuzzy matching: lowercase, strip punctuation, collapse spaces
def _norm(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[''`]", "", name)           # smart quotes
    name = re.sub(r"[^a-z0-9\s]", " ", name)   # punctuation → space
    name = re.sub(r"\s+", " ", name).strip()
    # strip common noise words that vary between sources
    for noise in ("theater", "theatre", "the ", "amsterdam"):
        name = name.replace(noise, "").strip()
    return name


def get_or_create_venue(session: Session, name: str, city: str = "Amsterdam") -> uuid.UUID:
    """
    Return the venue_id for `name`, creating a minimal Venue record if needed.
    Matching is case-insensitive and strips common noise words so that
    "Johan Cruijff ArenA" and "Johan Cruijff Arena" both resolve to the same row.
    """
    target = _norm(name)

    venues = session.exec(select(Venue).where(Venue.city == city)).all()
    for v in venues:
        if _norm(v.name) == target:
            return v.id

    # Not found — create a minimal record. Enrichment (image, description,
    # address, neighbourhood) can be added later via enrich_venues.py or manually.
    new_venue = Venue(
        name=name.strip(),
        city=city,
        priority="low",   # new/unknown venues start at Exploring
        active=True,
    )
    session.add(new_venue)
    session.flush()  # populate id without committing
    return new_venue.id
