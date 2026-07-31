import { createClient } from "./supabase/client";

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
  city_id?: string;
  website_url?: string;
  priority: "high" | "medium" | "low";
  address?: string;
  neighbourhood?: string;
  venue_type?: string;
  capacity?: number;
  description?: string;
  image_url?: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  country: string;
  timezone: string;
  is_active: boolean;
}

export interface WatchlistEntry {
  watchlist: { id: string; show_id: string; status: WatchStatus; notes?: string };
  show: Show;
}

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  is_public: boolean;
}

// ----------------------------------------------------------------
// Core data fetchers (public, no auth needed)
// ----------------------------------------------------------------

export const api = {
  async getUpcoming(limit = 100, offset = 0): Promise<Show[]> {
    const supabase = createClient();
    const today = localDateStr();
    const { data, error } = await supabase
      .from("show")
      .select("id,title,subtitle,venue_id,company_id,date,time,type,url,ticket_status,price_from,currency,summary,image_url")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (error) { console.error(error); return []; }
    return (data ?? []) as Show[];
  },

  async getVenues(): Promise<Venue[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("venue")
      .select("id,name,city_id,website_url,priority,address,neighbourhood,venue_type,capacity,description,image_url")
      .eq("active", true)
      .order("name");
    return (data ?? []) as Venue[];
  },

  async getCities(): Promise<City[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("city")
      .select("*")
      .order("name");
    return (data ?? []) as City[];
  },

  async getUserPreferences(): Promise<{ hide_duplicate_shows: boolean; default_city_id?: string } | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("user_preferences")
      .select("hide_duplicate_shows, default_city_id")
      .eq("user_id", user.id)
      .single();
    return data ?? null;
  },

  async updateUserPreferences(prefs: Partial<{ hide_duplicate_shows: boolean; default_city_id: string }>) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_preferences")
      .update(prefs)
      .eq("user_id", user.id);
  },

  // ----------------------------------------------------------------
  // Watchlist (requires auth session in browser)
  // ----------------------------------------------------------------

  async getWatchlist(): Promise<WatchlistEntry[]> {
    const supabase = createClient();
    const today = localDateStr();
    const { data, error } = await supabase
      .from("watchlist")
      .select("id, show_id, status, notes, show:show_id(*)")
      .gte("show.date", today)
      .order("show.date", { referencedTable: "show", ascending: true });
    if (error) { console.error(error); return []; }
    return (data ?? []).filter(r => r.show).map(r => ({
      watchlist: { id: r.id, show_id: r.show_id, status: r.status as WatchStatus, notes: r.notes ?? undefined },
      show: r.show as unknown as Show,
    }));
  },

  async getUserWatchlist(userId: string): Promise<WatchlistEntry[]> {
    const supabase = createClient();
    const today = localDateStr();
    const { data, error } = await supabase
      .from("watchlist")
      .select("id, show_id, status, notes, show:show_id(*)")
      .eq("user_id", userId)
      .gte("show.date", today);
    if (error) { console.error(error); return []; }
    return (data ?? []).filter(r => r.show).map(r => ({
      watchlist: { id: r.id, show_id: r.show_id, status: r.status as WatchStatus, notes: r.notes ?? undefined },
      show: r.show as unknown as Show,
    }));
  },

  async upsertWatch(showId: string, status: WatchStatus, notes?: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase.from("watchlist").upsert({
      user_id: user.id,
      show_id: showId,
      status,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,show_id" });
    if (error) throw error;
  },

  async removeWatch(showId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .match({ user_id: user.id, show_id: showId });
    if (error) throw error;
  },

  // ----------------------------------------------------------------
  // Social
  // ----------------------------------------------------------------

  async getProfile(username: string): Promise<Profile | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("profile")
      .select("*")
      .eq("username", username)
      .single();
    return data as Profile | null;
  },

  async getCurrentUser() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getFriends(): Promise<Profile[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("friendship")
      .select("profile:friend_id(id, username, display_name, is_public)")
      .eq("user_id", user.id);
    return ((data ?? []).map(r => r.profile).filter(Boolean) as Profile[]);
  },

  async addFriend(friendId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    await supabase.from("friendship").upsert({ user_id: user.id, friend_id: friendId });
  },

  async removeFriend(friendId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    await supabase.from("friendship").delete().match({ user_id: user.id, friend_id: friendId });
  },

  // ----------------------------------------------------------------
  // Admin (venue/company management — owner only)
  // ----------------------------------------------------------------

  async updateVenue(id: string, fields: Partial<Pick<Venue, "name" | "description" | "image_url" | "website_url" | "address" | "neighbourhood" | "priority">>): Promise<Venue> {
    const supabase = createClient();
    const { data, error } = await supabase.from("venue").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data as Venue;
  },

  async updateCompanyPriority(id: string, priority: "high" | "medium" | "low"): Promise<Company> {
    const supabase = createClient();
    const { data, error } = await supabase.from("company").update({ priority }).eq("id", id).select().single();
    if (error) throw error;
    return data as Company;
  },

  // ----------------------------------------------------------------
  // Calendar
  // ----------------------------------------------------------------

  calendarUrl(username?: string): string {
    const u = username ?? "claireheaded";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://houselights.claireheaded.com";
    return `${origin}/api/calendar/${u}.ics`.replace(/^https?:\/\//, "webcal://");
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Keep STATIC export for any remaining references — always false now
export const STATIC = false;
