# house lights

Amsterdam arts event tracker. Aggregates shows from 25+ venues — theatre, music, comedy, film — into a single feed you can filter, watchlist, and subscribe to via iCal.

**Live site**: [houselights.claireheaded.com](https://houselights.claireheaded.com)  
**Docs**: [docs.houselights.claireheaded.com](https://docs.houselights.claireheaded.com)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Astro 5 (SSR) + React + TypeScript |
| Backend | FastAPI + SQLModel + Python |
| Database | Supabase (Postgres + Auth + RLS) |
| Scraper jobs | GitHub Actions (cron) |
| Hosting | Vercel |

## How it works

Scrapers run on a schedule, pulling event listings from venue websites. Shows are normalised and stored in Supabase. The Astro frontend serves a filterable feed — by date, type, venue, and city. Users can watchlist shows and get an iCal feed for their calendar app.

Full write-up: [houselights.claireheaded.com/how-it-works](https://houselights.claireheaded.com/how-it-works)

## Development

This project uses a `dev` → `main` branch model. All work goes on `dev`; `main` is protected and updated only via PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, environment variables, migration process, and how to write a new scraper.

## Status

Currently in closed beta (invite-only). Covers Amsterdam venues.
