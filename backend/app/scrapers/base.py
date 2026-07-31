from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, time
from typing import Optional
import re

# Shared keyword patterns for type inference — used by multiple scrapers
_CABARET  = re.compile(r"\bcabaret\b", re.I)
_CIRCUS   = re.compile(r"\bcircus|acrobat|clown\b", re.I)
_SPOKEN   = re.compile(r"\bspoken.?word|storytell|verhalen|poetry.?slam\b", re.I)
_TALK     = re.compile(r"\blecture|lezing|symposium|panel\b", re.I)
_COMEDY   = re.compile(r"\bcomedi|comedian|stand.?up|humor|comedy\b", re.I)
_CLASSICAL= re.compile(r"\bclassical|orkest|symphony|kamer.?muziek|philharmon\b", re.I)
_DANCE    = re.compile(r"\bdans\b|dance|choreograph\b", re.I)
_THEATRE  = re.compile(r"\btheater|theatre|musical|toneel|voorstelling\b", re.I)
_OPERA    = re.compile(r"\bopera\b", re.I)


def infer_type(title: str, description: str = "") -> str:
    """Infer event type from title and optional description text."""
    text = f"{title} {description}"
    if _CABARET.search(text):  return "cabaret"
    if _CIRCUS.search(text):   return "circus"
    if _SPOKEN.search(text):   return "spoken_word"
    if _TALK.search(text):     return "talk"
    if _COMEDY.search(text):   return "comedy"
    if _OPERA.search(text):    return "opera"
    if _CLASSICAL.search(text):return "classical"
    if _DANCE.search(text):    return "dance"
    if _THEATRE.search(text):  return "theatre"
    return "other"


@dataclass
class ScrapedShow:
    title: str
    date: date
    url: str
    source_id: str  # unique key for dedup, e.g. "paradiso:12345"
    time: Optional[time] = None
    end_time: Optional[time] = None
    subtitle: Optional[str] = None
    type: Optional[str] = None
    ticket_status: Optional[str] = None  # available / sold_out / few_left / unknown
    price_from: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    venue_name: Optional[str] = None  # override venue resolution by name (e.g. sub-venues)


class BaseScraper(ABC):
    key: str  # matches scraper_key on Venue/Company

    @abstractmethod
    async def scrape(self) -> list[ScrapedShow]:
        ...
