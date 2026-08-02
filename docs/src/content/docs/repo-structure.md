---
title: Repository structure
description: What lives where in the house lights monorepo.
---

```
house-lights/
├── frontend/                   Astro web application
│   ├── src/
│   │   ├── components/         React + Astro components
│   │   ├── lib/                Shared utilities (api.ts, admin.ts, supabase/)
│   │   ├── pages/              Astro pages + API routes
│   │   │   └── api/            Server-side API endpoints
│   │   └── styles/             Global CSS
│   ├── astro.config.mjs
│   └── package.json
│
├── backend/                    Python scraper library
│   ├── app/
│   │   ├── scrapers/           One file per venue
│   │   ├── models/             SQLModel ORM models
│   │   ├── api/                FastAPI routes (local dev only)
│   │   └── db.py               Database connection
│   ├── enrich_descriptions.py  Post-scrape enrichment
│   ├── enrich_images.py        Post-scrape enrichment
│   ├── seed_venues.py          One-time venue seed script
│   └── pyproject.toml
│
├── supabase/                   Database migrations
│   ├── schema.sql              Full schema (reference copy)
│   └── migrate_NNN_*.sql       Sequential migration files
│
├── docs/                       This documentation site (Astro Starlight)
│
├── .github/
│   └── workflows/
│       ├── scrape.yml          Weekly scraper job
│       ├── semgrep.yml         SAST (JS/TS)
│       ├── bandit.yml          SAST (Python)
│       ├── njsscan.yml         Node.js security scan
│       ├── bearer.yml          Secret/data leakage scan
│       ├── osv-scanner.yml     Dependency CVE scan
│       └── scorecard.yml       OpenSSF Scorecard
│
├── CONTRIBUTING.md             Branch workflow and dev setup
└── README.md                   Project overview
```

## Key files to know

| File | Purpose |
|------|---------|
| `frontend/src/lib/api.ts` | All client-side Supabase queries and shared types |
| `frontend/src/lib/admin.ts` | `getIsAdmin()` — server-side admin check |
| `frontend/src/lib/supabase/service.ts` | `createServiceClient()` — service-role client for admin routes |
| `frontend/src/middleware.ts` | Sets `locals.supabase` and `locals.user` on every request |
| `backend/app/scrapers/base.py` | `BaseScraper` abstract class |
| `supabase/schema.sql` | Authoritative schema reference (not auto-applied) |
