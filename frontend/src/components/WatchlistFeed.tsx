import { useState, useEffect, useCallback } from "react";
import { localDateStr } from "../lib/api";
import type React from "react";
import { IconCalendarDown, IconBookmarkFilled, IconTicket, IconList, IconCalendar } from "@tabler/icons-react";
import { createClient } from "../lib/supabase/client";
import { api } from "../lib/api";
import type { WatchlistEntry, Venue, Company, Show, WatchStatus } from "../lib/api";
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

function GroupedCard({
  group,
  venueMap,
  companyMap,
  onWatchChange,
}: {
  group: ShowGroup;
  venueMap: Record<string, string>;
  companyMap: Record<string, string>;
  onWatchChange: () => void;
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
          const isCurrentYear = d.getFullYear() === new Date().getFullYear();
          const label = (isToday ? "TODAY" : d.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", ...(!isCurrentYear && { year: "numeric" }),
          })).toUpperCase();
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
  const [venues, setVenues] = useState<Venue[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayView, setDisplayView] = useState<DisplayView>("list");
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const [v, c] = await Promise.all([api.getVenues(), api.getCompanies()]);
      setVenues(v);
      setCompanies(c);

      if (user) {
        const [wl, prefs] = await Promise.all([
          api.getWatchlist(),
          api.getUserPreferences(),
        ]);
        setWatchlist(wl);
        if (prefs) setHideDuplicates(prefs.hide_duplicate_shows ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const venueMap = Object.fromEntries(venues.map((v) => [v.id, v.name]));
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-300 text-sm tracking-widest uppercase">
        Loading…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-sm text-[#888]">Sign in to build your watchlist.</p>
        <a href="/login" className="text-xs uppercase tracking-widest font-bold text-[#1a1a1a] border border-[#1a1a1a] px-4 py-2 hover:bg-[#1a1a1a] hover:text-white transition-colors">
          Sign in
        </a>
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
          <a
            href={api.calendarUrl()}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <IconCalendarDown size={13} />
            Subscribe
          </a>
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
