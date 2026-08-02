---
title: Writing a scraper
description: Step-by-step guide to adding a new venue scraper to house lights.
---

This guide walks through adding a scraper for a new venue from start to finish.

## 1. Add the venue to the database

Before writing the scraper, the venue needs a row in the `venue` table. Run this in the Supabase SQL editor (replace values):

```sql
insert into venue (name, scraper_key, website_url, active, city_id)
select
  'Venue Name',
  'venueslug',        -- short lowercase slug, no spaces
  'https://venue.nl',
  true,
  id from city where slug = 'amsterdam'
where not exists (
  select 1 from venue where scraper_key = 'venueslug'
);
```

Also add a corresponding migration file: `supabase/migrate_NNN_venuename_venue.sql`.

## 2. Create the scraper file

Create `backend/app/scrapers/venueslug.py`. Every scraper follows the same shape:

```python
"""
Venue Name scraper.
Brief note on the page structure / any quirks.
"""
import httpx
import logging
from bs4 import BeautifulSoup
from datetime import date, time
from .base import BaseScraper, ScrapedShow

logger = logging.getLogger(__name__)

AGENDA_URL = "https://venue.nl/agenda"
BASE_URL = "https://venue.nl"


class VenueNameScraper(BaseScraper):
    key = "venueslug"  # must match scraper_key in DB

    async def scrape(self) -> list[ScrapedShow]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(AGENDA_URL)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        shows: list[ScrapedShow] = []

        for card in soup.select("div.event-card"):
            title = card.select_one("h2")
            if not title:
                continue

            # parse date, time, url ...

            shows.append(ScrapedShow(
                title=title.get_text(strip=True),
                date=event_date,
                time=event_time,
                url=url,
                source_id=f"venueslug:{url}:{event_date.isoformat()}",
                type="music",  # or use infer_type()
            ))

        return shows
```

## 3. Register the scraper

Open `backend/app/scrapers/__init__.py` (or wherever scrapers are registered) and add your class to the list.

## 4. Test it locally

```bash
cd backend
python -c "
import asyncio
from app.scrapers.venueslug import VenueNameScraper
shows = asyncio.run(VenueNameScraper().scrape())
for s in shows[:5]:
    print(s)
"
```

## Common patterns

### Static HTML (most venues)

```python
async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
    resp = await client.get(AGENDA_URL)
    resp.raise_for_status()
soup = BeautifulSoup(resp.text, "html.parser")
```

### JavaScript-rendered pages

Use Playwright for venues that render their calendar client-side:

```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    page = await browser.new_page()
    await page.goto(AGENDA_URL, timeout=45000, wait_until="domcontentloaded")
    await page.wait_for_timeout(2000)  # let JS render
    html = await page.content()
    await browser.close()

soup = BeautifulSoup(html, "html.parser")
```

### Fetching detail pages in parallel

Don't fetch detail pages sequentially — use `asyncio.gather`:

```python
async def fetch_detail(url: str) -> tuple[str, str | None]:
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(url)
            if r.status_code == 200:
                s = BeautifulSoup(r.text, "html.parser")
                desc = s.select_one("meta[name=description]")
                return url, desc.get("content") if desc else None
    except Exception as e:
        logger.warning("detail fetch failed for %s: %s", url, e)
    return url, None

results = await asyncio.gather(*[fetch_detail(item["url"]) for item in items])
```

### Dutch month names

Many Dutch venue sites format dates in Dutch. A shared lookup:

```python
MONTHS_NL = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "augustus": 8,
    "september": 9, "oktober": 10, "november": 11, "december": 12,
}
```

## Things to get right

- **`source_id` must be stable** — it's the dedup key. Same show on a second run must produce the same `source_id`.
- **Skip past shows** — check `event_date >= date.today()` before appending.
- **Don't raise from detail fetches** — wrap in `try/except Exception as e: logger.warning(...)` so one broken detail page doesn't abort the whole run.
- **Don't set `priority`** — that column no longer exists.
