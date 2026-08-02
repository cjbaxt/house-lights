---
title: Frontend overview
description: How the Astro frontend is structured.
---

The frontend is an Astro 5 application with SSR enabled (`output: "server"`) and deployed on Vercel via `@astrojs/vercel`.

## Key concepts

### SSR everywhere

All pages are server-rendered. There is no static output. This means:
- Pages can read the user's session on every request
- Supabase queries happen server-side before HTML is sent
- Sensitive data (service-role key, user data) never leaks to the client

### React islands

Interactive components use `client:load` to hydrate in the browser. The main ones:
- `ShowFeed` — the filterable event feed
- `WatchlistFeed` — the user's watchlist
- `VenueList` — the venues/companies browser
- `CalendarBody` — the calendar view
- `Nav` — navigation with auth state

### Middleware

`src/middleware.ts` runs on every request. It creates a Supabase client scoped to the user's session and attaches it to `Astro.locals`:

```typescript
Astro.locals.supabase  // user-session Supabase client
Astro.locals.user      // current user (null if not signed in)
```

### Admin check

```typescript
import { getIsAdmin } from "../lib/admin";
const isAdmin = await getIsAdmin(Astro.locals.supabase, Astro.locals.user?.id);
```

This checks `profile.is_admin` in the database. Use it in every page and API route that needs admin access.

## Directory structure

```
frontend/src/
├── components/
│   ├── BaseHead.astro      Shared <head> for all pages
│   ├── Nav.tsx             Navigation bar
│   ├── ShowFeed.tsx        Main event feed
│   ├── WatchlistFeed.tsx   User's watchlist
│   ├── VenueList.tsx       Venue/company browser
│   ├── CalendarBody.tsx    Calendar view
│   └── ...
├── lib/
│   ├── api.ts              Client-side Supabase queries + shared types
│   ├── admin.ts            getIsAdmin() helper
│   ├── editor.ts           isEditor() — unlocks venue editing UI
│   ├── guest-watchlist.ts  localStorage watchlist for signed-out users
│   └── supabase/
│       ├── client.ts       createClient() — browser/user client
│       └── service.ts      createServiceClient() — service-role client
├── pages/
│   ├── index.astro         Home (show feed)
│   ├── about.astro         About + venue list
│   ├── watchlist.astro     Watchlist page
│   ├── venues.astro        Venues browser
│   ├── settings.astro      User settings
│   ├── admin.astro         Admin panel (admin only)
│   ├── how-it-works.astro  Public explainer
│   ├── privacy.astro       Privacy policy
│   └── api/                Server-side API routes
└── styles/
    └── global.css
```
