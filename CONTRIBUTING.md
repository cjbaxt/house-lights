# Contributing to house lights

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — deployed to Vercel automatically on merge |
| `dev`  | Active development — merge here first |

**All work happens on `dev`.** When a batch of changes is ready to ship, open a PR from `dev → main`. Main is protected: PRs require the security scans (Semgrep, njsscan, Bandit) to pass before merge.

```
dev  ──── feature work ────► PR ────► main ────► Vercel (production)
```

## Day-to-day workflow

```bash
# Make sure you're on dev and up to date
git checkout dev
git pull

# Do your work, commit normally
git add ...
git commit -m "..."
git push

# When ready to ship: open a PR on GitHub
# dev → main
# Wait for checks to pass, then merge
```

## CI checks

The following run on every push to `dev` and on every PR to `main`:

| Check | Tool | What it catches |
|-------|------|----------------|
| SAST (JS/TS) | Semgrep, njsscan | XSS, injection, insecure patterns |
| SAST (Python) | Bandit | Python security issues |
| Dependency audit | OSV Scanner | Known CVEs in dependencies |
| Secret scanning | Bearer | Hardcoded secrets, data leakage |
| SonarCloud | SonarCloud | Code quality and coverage |

PRs to `main` will be blocked if Semgrep or njsscan fail.

## Database migrations

Migrations live in `supabase/migrate_NNN_description.sql`. They are **not run automatically** — apply them manually in the Supabase SQL editor after merging to main.

Naming: `migrate_NNN_short_description.sql` where `NNN` is the next sequential number.

## Scraper jobs

Scrapers run as a scheduled GitHub Actions job (`scrape.yml`) every Monday at 06:00 UTC. They connect directly to Supabase via `DATABASE_URL` — the FastAPI backend is not deployed as a public service.

To run scrapers manually: trigger `Scrape & summarise` from the Actions tab.

## Environment variables

| Variable | Where used | Notes |
|----------|-----------|-------|
| `SUPABASE_URL` | Frontend (Vercel) | Public |
| `SUPABASE_ANON_KEY` | Frontend (Vercel) | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Frontend API routes (server-side only) | Secret |
| `DATABASE_URL` / `SUPABASE_SESSION_POOLER_URI` | Scraper GHA job | Secret |
| `BETA_CAP` | Frontend (Vercel) | Optional, defaults to 10 |
