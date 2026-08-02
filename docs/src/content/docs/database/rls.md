---
title: Row-level security
description: How Supabase RLS policies protect data in house lights.
---

Every table has RLS enabled. The frontend uses two Supabase clients:

- **Anon/user client** (`createClient()` in `lib/supabase/client.ts`) — used for user-facing queries. RLS policies apply.
- **Service-role client** (`createServiceClient()` in `lib/supabase/service.ts`) — bypasses RLS. Used only in server-side admin routes.

## Policy summary

### Public tables (read by anyone)

`city`, `venue`, `company`, `show` — no auth required to read.

### `profile`

- Anyone can read public profiles (`is_public = true`)
- Users can read and update their own profile

### `watchlist`

- Users can always read and write their own watchlist
- Public watchlists are readable by anyone
- Private watchlists are readable by followers (users who follow the profile owner)

### `friendship`

- Users can manage their own follows (insert/delete where `user_id = auth.uid()`)
- Users can see who follows them (select where `friend_id = auth.uid()`)

### `user_preferences`, `user_city`, `user_hidden_venue`

- Users can only read and write their own rows

### `invite_code`, `event_log`, `beta_waitlist`

- No public read. Service-role client only.

## The service-role client

```typescript
// frontend/src/lib/supabase/service.ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
```

Only import this in server-side API routes (`src/pages/api/`). Never expose it to the browser.
