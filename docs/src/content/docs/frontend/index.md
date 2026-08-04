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
- `Nav` — navigation with auth state, notification bell, avatar dropdown
- `NotificationBell` — real-time notification bell (Supabase Realtime subscription)
- `AvatarMenu` — user avatar dropdown (profile, settings, sign out)

### Middleware

`src/middleware.ts` runs on every request. It reads the session from the JWT cookie (no network call) and attaches the Supabase client and user to `Astro.locals`:

```typescript
Astro.locals.supabase  // user-session Supabase client
Astro.locals.user      // current user (null if not signed in)
```

Sessions are read via `getSession()` (cookie-based, fast) rather than `getUser()` (network call to Supabase auth server).

### Service client

`createServiceClient()` bypasses Row-Level Security. Use it for:
- Public stats that must cross RLS boundaries (follower counts, lists on profile pages)
- Server-side writes where the actor ≠ recipient (e.g. writing a follow notification)

Never expose the service-role key to the browser.

### Admin check

```typescript
import { getIsAdmin } from "../lib/admin";
const isAdmin = await getIsAdmin(Astro.locals.supabase, Astro.locals.user?.id);
```

This checks `profile.is_admin` in the database. Use it in every page and API route that needs admin access.

### View transitions

The app uses Astro view transitions (`<ViewTransitions />`). `Nav` has `transition:persist` so it survives page swaps. Any inline `<script>` that attaches event listeners must use the `astro:page-load` event to re-initialise after navigation:

```javascript
document.addEventListener("astro:page-load", () => {
  // re-attach listeners here
});
```

## Directory structure

```
frontend/src/
├── components/
│   ├── BaseHead.astro      Shared <head> for all pages
│   ├── Footer.astro        Shared footer (About, How it works, Privacy, Ko-fi, Contact)
│   ├── Nav.tsx             Navigation bar (Browse / Watchlist / Feed)
│   ├── AvatarMenu.tsx      User avatar dropdown
│   ├── NotificationBell.tsx Real-time notification bell
│   ├── ShowFeed.tsx        Main event feed
│   ├── WatchlistFeed.tsx   User's watchlist
│   ├── VenueList.tsx       Venue/company browser
│   ├── CalendarBody.tsx    Calendar view
│   └── ...
├── lib/
│   ├── api.ts              Client-side Supabase queries + shared types
│   ├── admin.ts            getIsAdmin() helper
│   ├── guest-watchlist.ts  localStorage watchlist for signed-out users
│   └── supabase/
│       ├── client.ts       createClient() — browser/user client
│       └── service.ts      createServiceClient() — service-role client
├── pages/
│   ├── index.astro         Home (show feed)
│   ├── about.astro         About + venue list
│   ├── watchlist.astro     Watchlist page
│   ├── feed.astro          Friend activity feed + people search
│   ├── venues.astro        Venues browser
│   ├── settings.astro      User settings
│   ├── admin.astro         Admin panel (admin only)
│   ├── how-it-works.astro  Public explainer
│   ├── privacy.astro       Privacy policy
│   ├── u/[username].astro  User profile page
│   └── api/                Server-side API routes
└── styles/
    └── global.css
```
