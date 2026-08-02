---
title: Environment variables
description: All environment variables used by house lights.
---

## Frontend (Vercel)

Set these in the Vercel project dashboard under Settings → Environment Variables.

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Your Supabase project URL — public, safe to expose |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key — public, RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — **secret**, server-side only |
| `BETA_CAP` | No | Max users during beta. Defaults to `10` if unset |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are used by the browser-side Supabase client (`lib/supabase/client.ts`). `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side API routes via `createServiceClient()` — it never reaches the browser.

## Scraper job (GitHub Actions secrets)

Set these in the repository's Settings → Secrets and variables → Actions.

| Secret | Used by | Notes |
|--------|---------|-------|
| `SUPABASE_SESSION_POOLER_URI` | `scrape.yml` | Supabase session pooler connection string for SQLModel |

## CI / scanning jobs

| Secret | Used by | Notes |
|--------|---------|-------|
| `SONAR_TOKEN` | `sonarcloud.yml` | SonarCloud project token |
| `SEMGREP_APP_TOKEN` | `semgrep.yml` | Semgrep Cloud token (optional) |
