---
title: Schema reference
description: Every table and column in the house lights database.
---

The authoritative schema file is `supabase/schema.sql`. This page documents it in readable form.

## `city`

Cities that house lights tracks.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | e.g. "Amsterdam" |
| `slug` | text unique | e.g. "amsterdam" |
| `country` | text | e.g. "NL" |
| `timezone` | text | e.g. "Europe/Amsterdam" |
| `is_active` | boolean | Only active cities appear in the UI |

## `venue`

Performance venues scraped by house lights.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Display name |
| `city_id` | uuid FK → city | |
| `website_url` | text | |
| `scrape_url` | text | URL to scrape (if different from website) |
| `scraper_key` | text | Matches `BaseScraper.key` |
| `active` | boolean | Inactive venues are not scraped or shown |
| `address` | text | |
| `neighbourhood` | text | |
| `venue_type` | text | theatre / concert_hall / arena / gallery / pub / outdoor / other |
| `capacity` | integer | |
| `description` | text | |
| `image_url` | text | |

## `company`

Theatre/production companies tracked by their own website (not a fixed venue).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `website_url` | text | |
| `scrape_url` | text | |
| `scraper_key` | text | |
| `active` | boolean | |
| `description` | text | |
| `image_url` | text | |

## `show`

Individual performances. One row per date — a run of 10 nights is 10 rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `title` | text | |
| `date` | date | |
| `time` | time | |
| `end_time` | time | |
| `subtitle` | text | |
| `type` | text | theatre / dance / music / classical / opera / comedy / cabaret / circus / spoken_word / talk / film / other |
| `ticket_status` | text | available / sold_out / few_left / unknown |
| `price_from` | numeric | |
| `url` | text | Ticket/show page |
| `description` | text | |
| `image_url` | text | |
| `source_id` | text unique | Scraper dedup key |
| `venue_id` | uuid FK → venue | |
| `city_id` | uuid FK → city | Denormalised for query performance |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

## `profile`

One row per auth user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK FK → auth.users | |
| `username` | text unique | |
| `display_name` | text | |
| `avatar_url` | text | Supabase Storage URL |
| `is_public` | boolean default true | Controls watchlist visibility |
| `is_admin` | boolean default false | Grants access to /admin |
| `created_at` | timestamptz | |

## `user_preferences`

Per-user feed settings.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK FK → auth.users | |
| `share_ticket_status` | boolean default false | Show ticket status to followers |
| `updated_at` | timestamptz | |

## `user_city`

Which cities appear in a user's feed.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → auth.users | |
| `city_id` | uuid FK → city | |
| PK | (user_id, city_id) | |

## `user_hidden_venue`

Venues hidden from a user's feed.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → auth.users | |
| `venue_id` | uuid FK → venue | |
| PK | (user_id, venue_id) | |

## `watchlist`

Shows bookmarked by users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `show_id` | uuid FK → show | |
| `status` | text | interested / tickets_bought / watched / skipped |
| `notes` | text | |
| `added_at` | timestamptz | |
| PK | (user_id, show_id) | |

## `friendship`

One-way follows between users.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → auth.users | The follower |
| `friend_id` | uuid FK → auth.users | The followed |
| `created_at` | timestamptz | |
| PK | (user_id, friend_id) | |

## `invite_code`

Beta invite codes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code` | text unique | e.g. "HL-AB3X7Y" |
| `note` | text | Optional label |
| `max_uses` | integer default 1 | How many times the code can be used |
| `use_count` | integer default 0 | How many times it has been used |
| `used_by` | uuid FK → auth.users | Last user to redeem it |
| `used_at` | timestamptz | |
| `created_at` | timestamptz | |

## `event_log`

Anonymous activity log for click-throughs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `event_type` | text | e.g. "ticket_click" |
| `user_id` | uuid | null if not signed in |
| `show_id` | uuid | |
| `venue_id` | uuid | |
| `city_id` | uuid | |
| `created_at` | timestamptz | |

## `beta_waitlist`

Email waitlist for when beta is full.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | text unique | |
| `name` | text | |
| `created_at` | timestamptz | |
