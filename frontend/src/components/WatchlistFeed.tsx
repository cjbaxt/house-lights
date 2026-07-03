import { useState, useEffect, useCallback } from "react";
import type React from "react";
import { IconCalendarDown, IconBookmarkFilled, IconTicket, IconList, IconCalendar, IconUsers } from "@tabler/icons-react";
import { api, STATIC } from "../lib/api";
import type { WatchlistEntry, Venue, Company, Show, WatchStatus } from "../lib/api";
import EventTypeIcon from "./EventTypeIcon";
import WatchMenu from "./WatchMenu";
import CalendarBody from "./CalendarBody";

type DisplayView = "list" | "calendar";
type WhoView = "claire" | "yours";

// Group key: title + venue/company — groups all dates of the same production together
function groupKey(show: Show): string {
  return `${show.title.toLowerCase()}|${show.venue_id ?? show.company_id ?? ""}`;
}

interface ShowGroup {
  key: string;
  show: Show; // representative show (first, for image/title/venue)
  entries: WatchlistEntry[]; // all dates, sorted by date
}

const DATE_CHIPS_LIMIT = 5;

function GroupedCard({
  group,
  venueMap,
  companyMap,
  onWatchChange,
  readOnly = false,
  claireToo = false,
}: {
  group: ShowGroup;
  venueMap: Record<string, string>;
  companyMap: Record<string, string>;
  onWatchChange: () => void;
  readOnly?: boolean;
  claireToo?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const { show } = group;
  const location =
    (show.venue_id ? venueMap[show.venue_id] : undefined) ||
    (show.company_id ? companyMap[show.company_id] : undefined) ||
    "";

  // Any entry has tickets_bought?
  const anyBought = group.entries.some((e) => e.watchlist.status === "tickets_bought");
  // representative status for bookmark icon
  const repStatus = anyBought ? "tickets_bought" : (group.entries[0]?.watchlist.status as WatchStatus);

  async function handleMarkBought(e: React.MouseEvent, entry: WatchlistEntry) {
    e.preventDefault();
    e.stopPropagation();
    const current = entry.watchlist.status;
    if (current === "tickets_bought") {
      await api.upsertWatch(entry.show.id, "interested");
    } else {
      await api.upsertWatch(entry.show.id, "tickets_bought");
    }
    onWatchChange();
  }

  const watchMenu = (
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
  );

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
            <div className="text-[9px] font-bold tracking-widest text-[#e85d2f] uppercase mb-1">
              {show.type ?? "other"}{location ? ` · ${location}` : ""}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-sans font-black text-sm uppercase tracking-tight text-[#1a1a1a] leading-tight truncate">
                {show.title}
              </span>
              {claireToo && <IconUsers size={12} className="flex-shrink-0 text-[#e85d2f]" />}
            </div>
            {show.subtitle && <div className="text-xs text-[#888] mt-0.5 truncate">{show.subtitle}</div>}
          </div>
        </a>
        <div className={`relative flex-shrink-0 ${readOnly ? "hidden" : ""}`}>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="p-1 hover:bg-[#ece7de] transition-colors mt-0.5">
            <IconBookmarkFilled size={15} className="text-[#e85d2f]" />
          </button>
          {menuOpen && watchMenu}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-4 pb-3">
        {(showAllDates ? group.entries : group.entries.slice(0, DATE_CHIPS_LIMIT)).map((entry) => {
          const d = new Date(entry.show.date + "T00:00:00");
          const isToday = entry.show.date === new Date().toISOString().slice(0, 10);
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
              {!readOnly && (
                <button onClick={(e) => handleMarkBought(e, entry)}
                  className={`p-0.5 transition-colors ${isBought ? "text-[#e85d2f]" : "text-[#d4c9b8] hover:text-[#888]"}`}>
                  <IconTicket size={11} />
                </button>
              )}
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
  const [myWatchlist, setMyWatchlist] = useState<WatchlistEntry[]>([]);
  const [clairesWatchlist, setClairesWatchlist] = useState<WatchlistEntry[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayView, setDisplayView] = useState<DisplayView>("list");
  const [whoView, setWhoView] = useState<WhoView>(STATIC ? "yours" : "claire");

  const load = useCallback(async () => {
    try {
      const [cw, v, c] = await Promise.all([
        api.getClairesWatchlist(), api.getVenues(), api.getCompanies(),
      ]);
      setMyWatchlist(api.getLocalWatchlist());
      setClairesWatchlist(cw);
      setVenues(v);
      setCompanies(c);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadMine = useCallback(() => {
    setMyWatchlist(api.getLocalWatchlist());
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

  const isClaires = whoView === "claire";
  const watchlist = isClaires ? clairesWatchlist : myWatchlist;
  const clairesKeys = new Set(clairesWatchlist.map((e) => groupKey(e.show)));

  // Build show groups: key → ShowGroup
  const groupMap = new Map<string, ShowGroup>();
  for (const entry of watchlist) {
    const key = groupKey(entry.show);
    if (!groupMap.has(key)) {
      groupMap.set(key, { key, show: entry.show, entries: [] });
    }
    groupMap.get(key)!.entries.push(entry);
  }
  // Sort entries within each group by date then time
  for (const g of groupMap.values()) {
    g.entries.sort((a, b) => {
      const dc = a.show.date.localeCompare(b.show.date);
      if (dc !== 0) return dc;
      return (a.show.time ?? "").localeCompare(b.show.time ?? "");
    });
  }

  const allGroups = Array.from(groupMap.values());

  // Single timeline sorted by earliest date in each group
  const sortedGroups = allGroups.sort(
    (a, b) => a.entries[0].show.date.localeCompare(b.entries[0].show.date)
  );

  const allShows = watchlist.map((e) => e.show);
  const venueNameMap = Object.fromEntries(venues.map((v) => [v.id, v.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {/* Who toggle */}
        <div className="flex items-center border border-[#ece7de] overflow-hidden">
          {([
            { key: "claire" as WhoView, label: "Claire's" },
            { key: "yours" as WhoView, label: "Yours" },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setWhoView(key)}
              className={`text-xs px-3 py-1.5 transition-colors ${whoView === key ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!isClaires && (
            <a
              href={api.calendarUrl()}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <IconCalendarDown size={13} />
              Export .ics
            </a>
          )}
          <div className="flex items-center border border-[#ece7de] overflow-hidden">
            {([
              { key: "calendar", icon: <IconCalendar size={13} /> },
              { key: "list",     icon: <IconList size={13} /> },
            ] as { key: DisplayView; icon: React.ReactNode }[]).map(({ key, icon }) => (
              <button key={key} onClick={() => setDisplayView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${displayView === key ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-widest text-neutral-400 mb-4">
        {watchlist.length} performance{watchlist.length !== 1 ? "s" : ""}
      </div>

      {!isClaires && STATIC && (
        <p className="text-xs text-neutral-400 mb-4">
          Your watchlist is saved in this browser. Clearing your cache will remove it.
        </p>
      )}

      {watchlist.length === 0 && (
        <div className="flex items-center justify-center h-64 text-neutral-400 text-sm">
          {isClaires ? "Claire hasn't watched anything yet." : "Nothing on your watchlist yet."}
        </div>
      )}

      {displayView === "calendar" ? (
        <CalendarBody shows={allShows} venueMap={venueNameMap} defaultView="month" />
      ) : (
        <div className="flex flex-col gap-2">
          {sortedGroups.map((group) => (
            <GroupedCard
              key={group.key}
              group={group}
              venueMap={venueMap}
              companyMap={companyMap}
              onWatchChange={reloadMine}
              readOnly={isClaires}
              claireToo={!isClaires && clairesKeys.has(group.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
