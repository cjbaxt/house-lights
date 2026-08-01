import type { WatchStatus } from "./api";

const KEY = "hl_guest_watchlist";

export interface GuestWatchEntry {
  show_id: string;
  status: WatchStatus;
  snapshot: {
    title: string;
    date: string;
    type?: string;
    venue_name?: string;
    url?: string;
    time?: string;
  };
  added_at: string;
}

export function getGuestWatchlist(): GuestWatchEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setGuestWatch(
  showId: string,
  status: WatchStatus,
  snapshot: GuestWatchEntry["snapshot"]
): void {
  const list = getGuestWatchlist().filter((e) => e.show_id !== showId);
  list.push({ show_id: showId, status, snapshot, added_at: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeGuestWatch(showId: string): void {
  const list = getGuestWatchlist().filter((e) => e.show_id !== showId);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getGuestWatchStatus(showId: string): WatchStatus | undefined {
  return getGuestWatchlist().find((e) => e.show_id === showId)?.status;
}

export function hasGuestWatchlistItems(): boolean {
  return getGuestWatchlist().length > 0;
}

export function clearGuestWatchlist(): void {
  localStorage.removeItem(KEY);
}
