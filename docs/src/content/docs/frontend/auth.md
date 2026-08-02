---
title: Authentication
description: How auth works in house lights.
---

Auth is handled entirely by Supabase Auth. The frontend never manages passwords or tokens directly.

## Sign-up flow

house lights is invite-only during beta. To register:

1. User enters invite code on `/login?mode=register`
2. `POST /api/auth/register` validates the code against the `invite_code` table
3. If valid, the code's `use_count` is incremented atomically (`.lt("use_count", max_uses)` filter prevents race conditions)
4. Supabase Auth creates the user
5. A `profile` row is created via database trigger

## Session management

Supabase Auth uses cookie-based sessions. The middleware (`src/middleware.ts`) reads the session cookie on every request and attaches `locals.supabase` (a user-scoped client) and `locals.user` to the Astro request context.

## Guest watchlist

Signed-out users can bookmark shows. These are stored in `localStorage` via `lib/guest-watchlist.ts`. When the user signs in or registers, the local items are merged into their account watchlist.

## Admin access

Admin status is stored as `profile.is_admin = true`. It is checked server-side on every protected page and API route using:

```typescript
import { getIsAdmin } from "../lib/admin";
const isAdmin = await getIsAdmin(Astro.locals.supabase, Astro.locals.user?.id);
```

To grant admin access, set `is_admin = true` directly in the database.
