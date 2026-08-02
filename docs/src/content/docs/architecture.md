---
title: Architecture
description: How the scraping pipeline, database, and frontend fit together.
---

house lights has three distinct layers that run independently of each other.

## Data flow

```
Venue websites
     │
     ▼
Python scrapers (GitHub Actions, weekly)
     │  httpx / BeautifulSoup / Playwright
     ▼
Supabase (PostgreSQL)
     │  Row-level security
     ▼
Astro frontend (Vercel, SSR)
     │  Server-side Supabase client
     ▼
User's browser
```

## Layer 1 — Scrapers

Each venue has a dedicated Python scraper in `backend/app/scrapers/`. Scrapers are plain Python classes that extend `BaseScraper` and return a list of `ScrapedShow` objects.

They run as a GitHub Actions job (`scrape.yml`) on a weekly schedule. The job connects directly to Supabase via `DATABASE_URL` (Supabase session pooler URI). There is no FastAPI server deployed in production — the backend exists only as a library of scrapers and utilities.

See [How scrapers work](/scrapers) and [Writing a scraper](/scrapers/writing-a-scraper).

## Layer 2 — Database

Supabase hosts a PostgreSQL database with:

- **Row-level security (RLS)** — every table has policies so the frontend can safely use the anon key and user session keys without leaking data between users
- **Auth** — Supabase Auth handles sign-up, sign-in, and session management
- **Storage** — profile avatars

See [Database schema](/database/schema) and [Row-level security](/database/rls).

## Layer 3 — Frontend

The frontend is an Astro application with SSR enabled via `@astrojs/vercel`. It queries Supabase directly from server-side page code (no separate API layer). React islands handle interactive components (feed, watchlist, calendar).

API routes in `frontend/src/pages/api/` handle mutations (watchlist updates, preferences, account management). Server-side routes use a service-role Supabase client (`lib/supabase/service.ts`) for admin operations.

See [Frontend overview](/frontend).

## What is not deployed

The FastAPI app in `backend/app/` exists for local development tooling and as a home for scraper logic. It is **not deployed as a public HTTP service**. All production traffic goes through the Astro frontend on Vercel.

## Key dependencies

| Concern | Tool |
|---------|------|
| Frontend framework | Astro 5 (SSR) |
| UI components | React 19 + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Vercel |
| Scraper HTTP | httpx (async) |
| Scraper HTML | BeautifulSoup4 |
| Scraper JS sites | Playwright (Chromium) |
| Scraper runtime | GitHub Actions |
| CI security | Semgrep, Bandit, njsscan, Bearer, OSV Scanner |
