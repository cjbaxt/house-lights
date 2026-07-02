from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, time
from typing import Optional


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


class BaseScraper(ABC):
    key: str  # matches scraper_key on Venue/Company

    @abstractmethod
    async def scrape(self) -> list[ScrapedShow]:
        ...
