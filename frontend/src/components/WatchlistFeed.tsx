import { useState, useEffect, useCallback } from "react";
import { localDateStr, formatDateChip } from "../lib/api";
import type React from "react";
import { IconCalendarDown, IconBookmarkFilled, IconTicket, IconList, IconCalendar } from "@tabler/icons-react";
import { createClient } from "../lib/supabase/client";
import { api } from "../lib/api";
import type { WatchlistEntry, Venue, Show, WatchStatus } from "../lib/api";
import type { GuestWatchEntry } from "../lib/guest-watchlist";
import WatchMenu from "./WatchMenu";
import CalendarBody from "./CalendarBody";

type DisplayView = "list" | "calendar";

function groupKey(show: Show): string {
  return `${show.title.toLowerCase()}|${show.venue_id ?? show.company_id ?? ""}`;
}

interface ShowGroup {
  key: string;
  show: Show;
  entries: WatchlistEntry[];
}

const DATE_CHIPS_LIMIT = 5;

interface FriendWatch {
  profile: { id: string; username: string; display_name?: string | null; avatar_url?: string | null };
  status: string;
}

function FriendAvatars({ friends }: { friends: FriendWatch[] }) {
  if (friends.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {friends.map(({ profile, status }) => {
        const name = profile.display_name ?? profile.username;
        const initials = name.slice(0, 2).toUpperCase();
        const label = status === "tickets_bought" ? `${name} — got tickets` : `${name} — interested`;
        return (
          <a
            key={profile.id}
            href={`/u/${profile.username}`}
            title={label}
            className="group/avatar relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-[#f0ede8] flex items-center justify-center ring-1 ring-white">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                : <span className="text-[7px] font-bold text-[#888]">{initials}</span>
              }
            </div>
            {status === "tickets_bought" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#e85d2f] rounded-full border border-white flex items-center justify-center">
                <span className="text-[5px] text-white font-bold">✓</span>
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

function GroupedCard({
  group,
  venueMap,
  companyMap,
  onWatchChange,
  friendWatches,
}: {
  group: ShowGroup;
  venueMap: Record<string, string>;
  companyMap: Record<string, string>;
  onWatchChange: () => void;
  friendWatches: FriendWatch[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const { show } = group;
  const location =
    (show.venue_id ? venueMap[show.venue_id] : undefined) ||
    (show.company_id ? companyMap[show.company_id] : undefined) ||
    "";

  const anyBought = group.entries.some((e) => e.watchlist.status === "tickets_bought");
  const repStatus = anyBought ? "tickets_bought" : (group.entries[0]?.watchlist.status as WatchStatus);

  async function handleMarkBought(e: React.MouseEvent, entry: WatchlistEntry) {
    e.preventDefault();
    e.stopPropagation();
    const current = entry.watchlist.status;
    await api.upsertWatch(entry.show.id, current === "tickets_bought" ? "interested" : "tickets_bought");
    onWatchChange();
  }

  return (
    <div className={`group border-b border-[#ece7de] hover:bg-white transition-colors ${anyBought ? "border-l-2 border-l-[#e85d2f]" : ""}`}>
      <div className="flex items-start gap-4 px-4 pt-3 pb-2">
        <a href={show.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 flex-1 min-w-0">
          {show.image_url && (
            <div className="w-16 flex-shrink-0 overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <img src={show.image_url} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold tracking-widest text-[#e85d2f] uppercase">
                {show.type ?? "other"}{location ? ` · ${location}` : ""}
              </span>
            </div>
            <div className="font-sans font-black text-sm uppercase tracking-tight text-[#1a1a1a] leading-tight truncate">
              {show.title}
            </div>
            {show.subtitle && <div className="text-xs text-[#888] mt-0.5 line-clamp-2">{show.subtitle}</div>}
            {friendWatches.length > 0 && (
              <div className="mt-1.5">
                <FriendAvatars friends={friendWatches} />
              </div>
            )}
          </div>
        </a>
        <div className="relative flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="p-1 hover:bg-[#ece7de] transition-colors mt-0.5">
            <IconBookmarkFilled size={15} className="text-[#e85d2f]" />
          </button>
          {menuOpen && (
            <WatchMenu
              showId={group.entries[0].show.id}
              current={repStatus}
              onSelect={async (status) => {
                await Promise.all(
                  group.entries.map(async (entry) => {
                    if (status === null) await api.removeWatch(entry.show.id);
                    else await api.upsertWatch(entry.show.id, status);
                  })
                );
                setMenuOpen(false);
                onWatchChange();
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-4 pb-3">
        {(showAllDates ? group.entries : group.entries.slice(0, DATE_CHIPS_LIMIT)).map((entry) => {
          const d = new Date(entry.show.date + "T00:00:00");
          const isToday = entry.show.date === localDateStr();
          const label = formatDateChip(entry.show.date);
          const isBought = entry.watchlist.status === "tickets_bought";
          const st = entry.show.ticket_status;
          const chipClass = isBought
            ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
            : st === "sold_out" ? "border-[#ece7de] text-[#ccc] line-through"
            : st === "few_left" ? "border-amber-300 text-amber-700"
            : "border-[#ece7de] text-[#888] hover:border-[#e85d2f] hover:text-[#e85d2f]";
          return (
            <div key={entry.show.id} className="flex items-center gap-0.5">
              <a href={entry.show.url} target="_blank" rel="noopener noreferrer"
                className={`text-[10px] font-bold px-2 py-0.5 border transition-colors tracking-wide ${chipClass}`}>
                {label}{entry.show.time ? ` ${entry.show.time.slice(0, 5)}` : ""}
              </a>
              <button onClick={(e) => handleMarkBought(e, entry)}
                className={`p-0.5 transition-colors ${isBought ? "text-[#e85d2f]" : "text-[#d4c9b8] hover:text-[#888]"}`}>
                <IconTicket size={11} />
              </button>
            </div>
          );
        })}
        {group.entries.length > DATE_CHIPS_LIMIT && (
          <button onClick={() => setShowAllDates((v) => !v)}
            className="text-[10px] font-bold px-2 py-0.5 border border-[#ece7de] text-[#aaa] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors tracking-wide">
            {showAllDates ? "SHOW LESS" : `+${group.entries.length - DATE_CHIPS_LIMIT} MORE`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function WatchlistFeed() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [guestWatchlist, setGuestWatchlist] = useState<GuestWatchEntry[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayView, setDisplayView] = useState<DisplayView>("list");
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [friendWatchMap, setFriendWatchMap] = useState<Record<string, FriendWatch[]>>({});

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const v = await api.getVenues();
      setVenues(v);

      if (user) {
        // Merge any guest items accumulated before login
        await api.mergeGuestWatchlist().catch(() => {});
        setGuestWatchlist([]);

        const [wl, prefs, tokenRes] = await Promise.all([
          api.getWatchlist(),
          api.getUserPreferences(),
          fetch("/api/calendar/token").then(r => r.json()).catch(() => null),
        ]);
        setWatchlist(wl);
        if (prefs) setHideDuplicates(prefs.hide_duplicate_shows ?? true);
        if (tokenRes?.token) setCalendarToken(tokenRes.token);

        if (wl.length > 0) {
          const showIds = [...new Set(wl.map((e) => e.show.id))].join(",");
          const fw = await fetch(`/api/watchlist/friend-watches?show_ids=${showIds}`)
            .then((r) => r.json())
            .catch(() => ({}));
          setFriendWatchMap(fw);
        }
      } else {
        const { getGuestWatchlist } = await import("../lib/guest-watchlist");
        setGuestWatchlist(getGuestWatchlist());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const venueMap = Object.fromEntries(venues.map((v) => [v.id, v.name]));
  const companyMap: Record<string, string> = {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-300 text-sm tracking-widest uppercase">
        Loading…
      </div>
    );
  }

  if (!currentUser) {
    const upcomingGuest = guestWatchlist.filter((e) => e.snapshot.date >= localDateStr());
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400">
            {upcomingGuest.length} show{upcomingGuest.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-3">
            <a href="/login?mode=signup" className="text-xs uppercase tracking-widest font-bold text-white bg-[#1a1a1a] border border-[#1a1a1a] px-3 py-1.5 hover:bg-[#333] transition-colors">
              Sign up
            </a>
            <a href="/login" className="text-xs uppercase tracking-widest text-[#888] hover:text-[#1a1a1a] transition-colors">
              Log in
            </a>
          </div>
        </div>
        {upcomingGuest.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-center px-4">
            <p className="text-sm text-[#888]">Browse shows and bookmark anything you want to see.</p>
            <p className="text-xs text-[#aaa] leading-relaxed max-w-xs">
              <a href="/login?mode=signup" className="font-bold text-[#1a1a1a] hover:underline">Sign up</a> to keep your watchlist safe, get a personal calendar feed, and see what your friends are watching.{" "}
              Already have an account? <a href="/login" className="font-bold text-[#1a1a1a] hover:underline">Log in</a>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="mb-4 px-4 py-3 bg-[#fff8f0] border border-[#f0d9b5] text-xs text-[#7a5c2e] leading-relaxed">
              <strong className="font-bold">Your watchlist is only saved in this browser.</strong>{" "}
              It will be lost if you clear your browser data or close a private window.{" "}
              <a href="/login?mode=signup" className="font-bold underline hover:text-[#1a1a1a] transition-colors">
                Sign up
              </a>{" "}
              to keep it permanently, get a calendar feed, and see what your friends are watching.{" "}
              Already have an account?{" "}
              <a href="/login" className="font-bold underline hover:text-[#1a1a1a] transition-colors">
                Log in
              </a>.
            </div>
            {upcomingGuest
              .sort((a, b) => a.snapshot.date.localeCompare(b.snapshot.date))
              .map((entry) => {
                const d = new Date(entry.snapshot.date + "T00:00:00");
                return (
                  <div key={entry.show_id} className="flex items-center gap-4 px-4 py-3 border-b border-[#ece7de] hover:bg-white transition-colors group border-l-2 border-l-[#e85d2f]">
                    <div className="flex-shrink-0 w-10 text-center">
                      <div className="text-xl font-black leading-none text-[#e85d2f]">{d.getDate()}</div>
                      <div className="text-[9px] font-bold tracking-widest text-[#bbb] mt-0.5">
                        {d.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
                      </div>
                    </div>
                    <div className="w-px h-10 bg-[#ece7de] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold tracking-widest text-[#e85d2f] uppercase mb-0.5">
                        {entry.snapshot.type ?? "other"}{entry.snapshot.venue_name ? ` · ${entry.snapshot.venue_name}` : ""}
                        {entry.snapshot.time && <span className="text-[#bbb] font-normal normal-case tracking-normal ml-2">{entry.snapshot.time.slice(0, 5)}</span>}
                      </div>
                      <div className="font-sans font-bold text-sm text-[#1a1a1a] uppercase tracking-tight leading-tight truncate">
                        {entry.snapshot.title || entry.show_id}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const { removeGuestWatch, getGuestWatchlist } = await import("../lib/guest-watchlist");
                        removeGuestWatch(entry.show_id);
                        setGuestWatchlist(getGuestWatchlist());
                      }}
                      className="flex-shrink-0 p-1 hover:bg-[#ece7de] transition-colors"
                      title="Remove from watchlist"
                    >
                      <IconBookmarkFilled size={15} className="text-[#e85d2f]" />
                    </button>
                  </div>
                );
              })}
            <p className="text-[10px] text-[#aaa] mt-4 text-center">
              <a href="/login?mode=signup" className="font-bold text-[#888] hover:text-[#1a1a1a] transition-colors">Sign up</a> to keep this safe, get a calendar feed, and see what friends are watching.
            </p>
          </div>
        )}
      </div>
    );
  }

  const groupMap = new Map<string, ShowGroup>();
  for (const entry of watchlist) {
    const key = groupKey(entry.show);
    if (!groupMap.has(key)) groupMap.set(key, { key, show: entry.show, entries: [] });
    groupMap.get(key)!.entries.push(entry);
  }
  for (const g of groupMap.values()) {
    g.entries.sort((a, b) => {
      const dc = a.show.date.localeCompare(b.show.date);
      return dc !== 0 ? dc : (a.show.time ?? "").localeCompare(b.show.time ?? "");
    });
  }

  const sortedGroups = Array.from(groupMap.values()).sort(
    (a, b) => a.entries[0].show.date.localeCompare(b.entries[0].show.date)
  );

  const showStatuses = Object.fromEntries(watchlist.map((e) => [e.show.id, e.watchlist.status]));

  // For calendar: if hideDuplicates, drop "interested" entries for shows where you already have tickets
  const calendarShows = (() => {
    if (!hideDuplicates) return watchlist.map((e) => e.show);
    const boughtKeys = new Set(
      sortedGroups.filter(g => g.entries.some(e => e.watchlist.status === "tickets_bought")).map(g => g.key)
    );
    return watchlist
      .filter(e => !(boughtKeys.has(groupKey(e.show)) && e.watchlist.status !== "tickets_bought"))
      .map(e => e.show);
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-widest text-neutral-400">
          {sortedGroups.length} show{sortedGroups.length !== 1 ? "s" : ""}
        </div>

        <div className="flex items-center gap-3">
          {calendarToken && (
            <a
              href={`webcal://${window.location.host}/api/calendar/${calendarToken}.ics`}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              title="Subscribe in your calendar app"
            >
              <IconCalendarDown size={13} />
              Subscribe
            </a>
          )}
          <div className="flex items-center border border-[#ece7de] overflow-hidden">
            {([
              { key: "calendar", icon: <IconCalendar size={13} /> },
              { key: "list",     icon: <IconList size={13} /> },
            ] as { key: DisplayView; icon: React.ReactNode }[]).map(({ key, icon }) => (
              <button key={key} onClick={() => setDisplayView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${displayView === key ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {watchlist.length === 0 && (
        <div className="flex items-center justify-center h-64 text-neutral-400 text-sm">
          Nothing on your watchlist yet — browse shows and bookmark anything you want to see.
        </div>
      )}

      {displayView === "calendar" && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={async () => {
              const next = !hideDuplicates;
              setHideDuplicates(next);
              if (currentUser) {
                await api.updateUserPreferences({ hide_duplicate_shows: next });
              }
            }}
            className={`text-[10px] uppercase tracking-widest px-3 py-1 border transition-colors ${hideDuplicates ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#ece7de] text-[#888] hover:border-[#1a1a1a]"}`}
          >
            Hide other dates when I have tickets
          </button>
        </div>
      )}
      {displayView === "calendar" ? (
        <CalendarBody shows={calendarShows} venueMap={venueMap} defaultView="month" showStatuses={showStatuses} />
      ) : (
        <div className="flex flex-col gap-2">
          {sortedGroups.slice(0, visibleCount).map((group) => (
            <GroupedCard
              key={group.key}
              group={group}
              venueMap={venueMap}
              companyMap={companyMap}
              onWatchChange={load}
              friendWatches={(() => {
                const seen = new Map<string, FriendWatch>();
                for (const fw of group.entries.flatMap((e) => friendWatchMap[e.show.id] ?? [])) {
                  const existing = seen.get(fw.profile.id);
                  if (!existing || fw.status === "tickets_bought") seen.set(fw.profile.id, fw);
                }
                return Array.from(seen.values());
              })()}
            />
          ))}
          {visibleCount < sortedGroups.length && (
            <button
              onClick={() => setVisibleCount((n) => n + 10)}
              className="text-[11px] font-bold uppercase tracking-widest text-[#aaa] hover:text-[#666] transition-colors py-4 text-center"
            >
              Load more ({sortedGroups.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
