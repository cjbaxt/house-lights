---
title: API routes
description: All server-side API endpoints in the house lights frontend.
---

API routes live in `frontend/src/pages/api/`. They are Astro endpoint files (`.ts`) that export `GET`, `POST`, `DELETE` etc handlers.

## Auth

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Register with invite code |
| `/api/auth/signout` | POST | Sign out |

## User

| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/preferences` | POST | Update `share_ticket_status` and other preferences |
| `/api/users/follow` | POST | Follow or unfollow another user |
| `/api/users/search` | GET | Search users by username/display name |
| `/api/notifications` | GET | List unread notifications for the current user |
| `/api/notifications` | POST | Mark notifications as read |
| `/api/profile` | POST | Update profile (display name, avatar) |

## Account

| Route | Method | Description |
|-------|--------|-------------|
| `/api/account/delete` | POST | Delete account and all data |
| `/api/account/export` | GET | Download account data as JSON |

## Shows

| Route | Method | Description |
|-------|--------|-------------|
| `/api/shows` | GET | Paginated show feed with filters |
| `/api/out` | GET | Ticket link click-through (logs to `event_log`, redirects) |

## Watchlist

| Route | Method | Description |
|-------|--------|-------------|
| `/api/watchlist` | POST | Add or update a watchlist entry |
| `/api/watchlist` | DELETE | Remove a watchlist entry |
| `/api/watchlist/friend-watches` | GET | Get friend watchlist activity for given show IDs |

## Calendar

| Route | Method | Description |
|-------|--------|-------------|
| `/api/calendar/[username].ics` | GET | iCalendar feed for a user's watchlist |

## Venue

| Route | Method | Description |
|-------|--------|-------------|
| `/api/venue/hidden` | POST | Hide or unhide a venue from the user's feed |
| `/api/venue/cities` | POST | Enable or disable a city in the user's feed |

## Admin (admin only)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/invite-codes` | GET | List all invite codes |
| `/api/admin/invite-codes` | POST | Generate new invite codes |
| `/api/admin/invite-codes` | DELETE | Delete an invite code |

## Beta

| Route | Method | Description |
|-------|--------|-------------|
| `/api/beta/signup` | GET | Check beta capacity |
| `/api/beta/signup` | POST | Join waitlist |

## Auth pattern

Every API route that requires authentication checks `locals.user`:

```typescript
export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });
  // ...
};
```

Admin routes also check `is_admin`:

```typescript
import { getIsAdmin } from "../../../lib/admin";

export const POST: APIRoute = async ({ locals }) => {
  if (!await getIsAdmin(locals.supabase, locals.user?.id)) {
    return new Response("Forbidden", { status: 403 });
  }
  // ...
};
```
