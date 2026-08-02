---
title: Vercel deployment
description: How the frontend and docs are deployed to Vercel.
---

house lights runs two Vercel projects: the main site and the documentation site.

## Main site

**Framework**: Astro 5, `output: "server"` (SSR)  
**Root directory**: `frontend/`  
**Build command**: `npm run build`  
**Output directory**: `.vercel/output` (handled automatically by `@astrojs/vercel`)

The site is deployed to `houselights.claireheaded.com`.

### Deploy flow

1. Push to `main` — Vercel picks it up automatically
2. Vercel installs dependencies, runs `astro build`
3. Serverless functions are created for each API route
4. Static assets go to Vercel's edge CDN

### Branch previews

Vercel creates preview URLs for every PR. Preview deployments use the same environment variables as production.

## Docs site

**Framework**: Astro 5 + Starlight  
**Root directory**: `docs/`  
**Build command**: `npm run build`  

The docs are deployed to `docs.houselights.claireheaded.com`.

To set this up as a separate Vercel project:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the same GitHub repo
3. Set **Root Directory** to `docs`
4. Add a custom domain: `docs.houselights.claireheaded.com`

The docs site needs no environment variables — it's a static build with no Supabase access.
