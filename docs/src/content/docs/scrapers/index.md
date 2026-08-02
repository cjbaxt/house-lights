---
title: How scrapers work
description: An overview of the house lights scraping pipeline.
---

Scrapers are the heart of house lights. Each venue has a dedicated Python class that knows how to read that venue's programme and return a list of structured show objects.

## Execution

Scrapers run as a GitHub Actions job (`scrape.yml`) every Monday at 06:00 UTC. You can also trigger a run manually from the Actions tab. Each run:

1. Installs Python dependencies and Playwright browsers
2. Runs every active scraper concurrently
3. Upserts shows to Supabase (existing shows are updated, new ones inserted)
4. Runs the description and image enrichment passes

## The `ScrapedShow` type

Every scraper returns a list of `ScrapedShow` objects:

```python
@dataclass
class ScrapedShow:
    title: str
    date: date
    venue_id: uuid.UUID
    city_id: uuid.UUID
    source_id: str          # unique identifier for deduplication, e.g. "paradiso:12345"
    time: time | None = None
    url: str | None = None
    type: str | None = None  # "theatre", "music", "dance", etc.
    ticket_status: str | None = None  # "available", "sold_out"
    description: str | None = None
    image_url: str | None = None
```

`source_id` is the key deduplication field. It must be stable across runs for the same show — typically `"scraperkey:external_id"` or `"scraperkey:url:date"`.

## Enrichment

After scraping, two enrichment scripts run over shows that have a URL but are missing a description or image:

- `enrich_descriptions.py` — fetches `og:description` from each show's page
- `enrich_images.py` — fetches `og:image`

These are separate passes so the main scraper doesn't slow down trying to fetch every detail page.

## Venue matching

Venues are looked up by `scraper_key` (a short slug like `"paradiso"`, `"melkweg"`). The `venue_matcher.py` utility handles this. If a scraper encounters a venue name that doesn't match any known venue, it creates a new one automatically — useful when a venue has a co-presenting partner not yet in the database.

## Logging

Each scraper uses Python's standard `logging` module. Log output is captured by GitHub Actions and available in the workflow run history. Failed detail-page fetches are logged at `WARNING` level and don't abort the overall run.
