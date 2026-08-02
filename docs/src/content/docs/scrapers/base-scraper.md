---
title: BaseScraper reference
description: The BaseScraper abstract class and ScrapedShow type.
---

All scrapers live in `backend/app/scrapers/` and extend `BaseScraper`.

## `BaseScraper`

```python
class BaseScraper(ABC):
    key: str  # matches scraper_key on the venue row in the DB

    @abstractmethod
    async def scrape(self) -> list[ScrapedShow]:
        ...
```

`key` must match the `scraper_key` column in the `venue` (or `company`) table. The scrape runner uses this to look up the venue's `id` and `city_id` before writing shows.

## `ScrapedShow`

```python
@dataclass
class ScrapedShow:
    title: str
    date: date
    url: str
    source_id: str              # unique key for dedup, e.g. "paradiso:12345"
    time: time | None = None
    end_time: time | None = None
    subtitle: str | None = None
    type: str | None = None     # see event types below
    ticket_status: str | None = None  # "available" | "sold_out" | "few_left" | "unknown"
    price_from: float | None = None
    description: str | None = None
    image_url: str | None = None
    venue_name: str | None = None  # override venue resolution (for sub-venues)
```

### `source_id`

Must be **stable and unique** across runs for the same show. It is used to upsert shows — the same `source_id` on a second run updates the existing row rather than creating a duplicate.

Good patterns:
- `"paradiso:12345"` — scraper key + venue's own ID
- `"melkweg:https://melkweg.nl/nl/agenda/show/12345"` — scraper key + canonical URL
- `"boomchicago:https://boomchicago.nl/show/slug:2026-08-15"` — scraper key + URL + date (for recurring shows)

### Event types

The `type` field uses a fixed vocabulary:

| Value | Description |
|-------|-------------|
| `theatre` | Theatre, performance, toneel |
| `dance` | Dance, choreography |
| `music` | Live music (general) |
| `classical` | Classical, orchestra, chamber music |
| `opera` | Opera |
| `comedy` | Stand-up, comedy |
| `cabaret` | Cabaret |
| `circus` | Circus, acrobatics |
| `spoken_word` | Spoken word, storytelling, poetry slam |
| `talk` | Lecture, panel, symposium |
| `film` | Film screening |
| `other` | Anything else |

Use `infer_type(title, description)` from `base.py` if you don't know the type — it applies keyword patterns to guess.

## `infer_type`

```python
from .base import infer_type

show_type = infer_type(title="Swan Lake", description="A ballet by Tchaikovsky")
# → "dance"
```

Patterns cover Dutch and English keywords. Returns `"other"` if nothing matches.
