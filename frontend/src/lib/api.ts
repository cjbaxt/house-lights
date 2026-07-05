const BASE = "/api";

export const STATIC = import.meta.env.PUBLIC_STATIC_DATA === "true";
const DATA_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

async function staticFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`);
  return res.json();
}

export type TicketStatus = "available" | "sold_out" | "few_left" | "unknown";
export type WatchStatus = "interested" | "tickets_bought" | "waitlisting" | "maybe" | "passed";

export interface Show {
  id: string;
  title: string;
  subtitle?: string;
  venue_id?: string;
  company_id?: string;
  date: string;
  time?: string;
  type?: string;
  url?: string;
  ticket_status?: TicketStatus;
  price_from?: number;
  currency: string;
  description?: string;
  summary?: string;
  image_url?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  website_url?: string;
  priority: "high" | "medium" | "low";
  address?: string;
  neighbourhood?: string;
  venue_type?: string;
  capacity?: number;
  description?: string;
  image_url?: string;
}

export interface Company {
  id: string;
  name: string;
  website_url?: string;
  priority: "high" | "medium" | "low";
  description?: string;
}

export interface WatchlistEntry {
  watchlist: { id: string; show_id: string; status: WatchStatus; notes?: string };
  show: Show;
}

// Watchlist in static mode uses localStorage
const STATIC_WATCHLIST_KEY = "house_lights_watchlist";

function staticGetWatchlist(): WatchlistEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STATIC_WATCHLIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function staticSaveWatchlist(entries: WatchlistEntry[]) {
  localStorage.setItem(STATIC_WATCHLIST_KEY, JSON.stringify(entries));
}

export const api = {
  async getUpcoming(limit = 100, offset = 0): Promise<Show[]> {
    if (STATIC) {
      const all = await staticFetch<Show[]>("/data/shows.json");
      return all.slice(offset, offset + limit);
    }
    const r = await fetch(`${BASE}/shows/upcoming?limit=${limit}&offset=${offset}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  },
  async getVenues(): Promise<Venue[]> {
    if (STATIC) return staticFetch<Venue[]>("/data/venues.json");
    const r = await fetch(`${BASE}/venues`);
    return r.json();
  },
  async getCompanies(): Promise<Company[]> {
    if (STATIC) return staticFetch<Company[]>("/data/companies.json");
    const r = await fetch(`${BASE}/companies`);
    return r.json();
  },
  async getClairesWatchlist(): Promise<WatchlistEntry[]> {
    if (STATIC) {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      try {
        const res = await fetch(`${base}/data/watchlist.json`);
        return res.ok ? res.json() : [];
      } catch {
        return [];
      }
    }
    const r = await fetch(`${BASE}/watchlist/`);
    return r.json();
  },
  getLocalWatchlist(): WatchlistEntry[] {
    return staticGetWatchlist();
  },
  async getWatchlist(): Promise<WatchlistEntry[]> {
    if (STATIC) return staticGetWatchlist();
    const r = await fetch(`${BASE}/watchlist/`);
    return r.json();
  },
  async upsertWatch(showId: string, status: WatchStatus, notes?: string) {
    if (STATIC) {
      const entries = staticGetWatchlist();
      const idx = entries.findIndex(e => e.watchlist.show_id === showId);
      if (idx >= 0) {
        entries[idx].watchlist.status = status;
        entries[idx].watchlist.notes = notes;
      } else {
        // find the show from the static data
        const shows = await staticFetch<Show[]>("/data/shows.json");
        const show = shows.find(s => s.id === showId);
        if (show) {
          entries.push({
            watchlist: { id: crypto.randomUUID(), show_id: showId, status, notes },
            show,
          });
        }
      }
      staticSaveWatchlist(entries);
      return;
    }
    await fetch(`${BASE}/watchlist/${showId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_id: showId, status, notes }),
    });
  },
  async removeWatch(showId: string) {
    if (STATIC) {
      staticSaveWatchlist(staticGetWatchlist().filter(e => e.watchlist.show_id !== showId));
      return;
    }
    await fetch(`${BASE}/watchlist/${showId}`, { method: "DELETE" });
  },
  async getRecommended(q?: string, limit = 20): Promise<Show[]> {
    if (STATIC) return [];
    const params = new URLSearchParams({ limit: String(limit) });
    if (q) params.set("q", q);
    const r = await fetch(`${BASE}/shows/recommended?${params}`);
    return r.json();
  },
  async updateVenuePriority(id: string, priority: "high" | "medium" | "low"): Promise<Venue> {
    const r = await fetch(`${BASE}/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    return r.json();
  },
  async updateVenue(id: string, fields: Partial<Pick<Venue, "name" | "description" | "image_url" | "website_url" | "address" | "neighbourhood" | "priority">>): Promise<Venue> {
    const r = await fetch(`${BASE}/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    return r.json();
  },
  async updateCompanyPriority(id: string, priority: "high" | "medium" | "low"): Promise<Company> {
    const r = await fetch(`${BASE}/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    return r.json();
  },
  calendarUrl() {
    if (STATIC) {
      // webcal:// triggers calendar subscription in Google Calendar / Apple Calendar
      const httpsUrl = `${window.location.origin}${DATA_BASE}/data/watchlist.ics`;
      return httpsUrl.replace(/^https?:\/\//, "webcal://");
    }
    return `${BASE}/calendar/watchlist.ics`;
  },
};
