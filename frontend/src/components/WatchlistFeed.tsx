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
  const allStatuses = new Set(group.entries.map((e) => e.watchlist.status));
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

  return (
    <div className={`bg-white border rounded-xl hover:border-neutral-300 transition-colors group ${anyBought ? "border-l-2 border-neutral-300 border-l-amber-400" : "border-neutral-100"}`}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <a
          href={show.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 flex-1 min-w-0"
        >
          {show.image_url ? (
            <div
              className="w-12 md:w-20 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100"
              style={{ aspectRatio: "4/3" }}
            >
              <img
                src={show.image_url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div
              className="w-12 md:w-20 border border-neutral-200 rounded-lg flex items-center justify-center flex-shrink-0 text-neutral-400"
              style={{ aspectRatio: "4/3" }}
            >
              <EventTypeIcon type={show.type} size={14} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-neutral-400 flex-shrink-0">
                <EventTypeIcon type={show.type} size={13} />
              </span>
              <span className="font-serif text-sm md:text-base font-medium text-neutral-900 truncate">
                {show.title}
              </span>
              {claireToo && (
                <span title="Claire wants to see this too" className="flex-shrink-0 text-rose-400 cursor-default">
                  <IconUsers size={13} />
                </span>
              )}
            </div>
            {show.subtitle && (
              <div className="text-xs text-neutral-400 mt-0.5 truncate">{show.subtitle}</div>
            )}
            <div className="text-xs text-neutral-400 mt-0.5">{location}</div>
          </div>
        </a>

        {/* Bookmark / watch menu */}
        <div className={`relative flex-shrink-0 ${readOnly ? "hidden" : ""}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors mt-0.5"
          >
            <IconBookmarkFilled size={15} className="text-neutral-700" />
          </button>
          {menuOpen && (
            <WatchMenu
              showId={group.entries[0].show.id}
              current={repStatus}
              onSelect={async (status) => {
                // Apply to ALL entries in the group
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

      {/* Date chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        {(showAllDates ? group.entries : group.entries.slice(0, DATE_CHIPS_LIMIT)).map((entry) => {
          const d = new Date(entry.show.date + "T00:00:00");
          const isToday = entry.show.date === new Date().toISOString().slice(0, 10);
          const isCurrentYear = d.getFullYear() === new Date().getFullYear();
          const label = isToday
            ? "Today"
            : d.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                ...(!isCurrentYear && { year: "numeric" }),
              });
          const isBought = entry.watchlist.status === "tickets_bought";
          const st = entry.show.ticket_status;
          const chipClass = isBought
            ? "border-neutral-700 bg-neutral-900 text-white"
            : st === "sold_out"
            ? "border-neutral-100 text-neutral-300 line-through"
            : st === "few_left"
            ? "border-amber-100 text-amber-600"
            : "border-neutral-200 text-neutral-500 hover:border-neutral-400";
          const chipTitle = isBought
            ? "Ticket bought"
            : st === "sold_out"
            ? "Sold out"
            : st === "few_left"
            ? "Few tickets left"
            : undefined;

          return (
            <div key={entry.show.id} className="flex items-center gap-0.5">
              <a
                href={entry.show.url}
                target="_blank"
                rel="noopener noreferrer"
                title={chipTitle}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${chipClass}`}
              >
                {label}
                {entry.show.time ? ` ${entry.show.time.slice(0, 5)}` : ""}
              </a>
              {!readOnly && (
                <button
                  onClick={(e) => handleMarkBought(e, entry)}
                  title={isBought ? "Unmark as bought" : "Mark as tickets bought"}
                  className={`p-0.5 rounded transition-colors ${
                    isBought ? "text-neutral-700" : "text-neutral-300 hover:text-neutral-500"
                  }`}
                >
                  <IconTicket size={11} />
                </button>
              )}
            </div>
          );
        })}
        {group.entries.length > DATE_CHIPS_LIMIT && (
          <button
            onClick={() => setShowAllDates((v) => !v)}
            className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {showAllDates ? "show less" : `+${group.entries.length - DATE_CHIPS_LIMIT} more`}
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
    const [cw, v, c] = await Promise.all([
      api.getClairesWatchlist(), api.getVenues(), api.getCompanies(),
    ]);
    setMyWatchlist(api.getLocalWatchlist());
    setClairesWatchlist(cw);
    setVenues(v);
    setCompanies(c);
    setLoading(false);
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
        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
          {([
            { key: "claire" as WhoView, label: "Claire's" },
            { key: "yours" as WhoView, label: "Yours" },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setWhoView(key)}
              className={`text-xs px-3 py-1.5 transition-colors ${whoView === key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
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
          <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
            {([
              { key: "calendar", icon: <IconCalendar size={13} /> },
              { key: "list",     icon: <IconList size={13} /> },
            ] as { key: DisplayView; icon: React.ReactNode }[]).map(({ key, icon }) => (
              <button key={key} onClick={() => setDisplayView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${displayView === key ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-50"}`}
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
