import { useState, useEffect, useMemo, useRef } from "react";
import type React from "react";
import { IconList, IconCalendar, IconLayoutGrid, IconAdjustmentsHorizontal, IconBookmark, IconBookmarkFilled, IconTicket, IconSearch, IconX } from "@tabler/icons-react";
import { api } from "../lib/api";
import type { Show, Venue, Company, WatchlistEntry, WatchStatus } from "../lib/api";
import ShowCard from "./ShowCard";
import CalendarBody from "./CalendarBody";
import EventTypeIcon from "./EventTypeIcon";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Timeframe = "today" | "week" | "month" | "all";
type Priority = "high" | "medium" | "low";
type DisplayView = "programme" | "agenda" | "calendar";

const ALL_TYPES = ["music", "classical", "theatre", "comedy", "ballet", "dance", "opera", "other"];
const PRIORITY_LABELS: Record<Priority, string> = { high: "Regular", medium: "Occasional", low: "Exploring" };

function endOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfMonth(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

const CHIP_LIMIT = 5;

type DateEntry = { id: string; date: string; status: string; time?: string };

function ProgrammeCard({ show, allDates, location, watchMap, onWatchChange }: {
  show: Show;
  allDates: DateEntry[];
  location: string;
  watchMap: Record<string, WatchStatus>;
  onWatchChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? allDates : allDates.slice(0, CHIP_LIMIT);
  const hidden = allDates.length - CHIP_LIMIT;
  const anyWatched = allDates.some(d => watchMap[d.id] && watchMap[d.id] !== "passed");

  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (anyWatched) {
      await Promise.all(allDates.map(d => api.removeWatch(d.id)));
    } else {
      await Promise.all(allDates.map(d => api.upsertWatch(d.id, "interested")));
    }
    onWatchChange();
  }

  async function handleMarkBought(e: React.MouseEvent, showId: string) {
    e.preventDefault();
    e.stopPropagation();
    const current = watchMap[showId];
    if (current === "tickets_bought") {
      await api.upsertWatch(showId, "interested");
    } else {
      await api.upsertWatch(showId, "tickets_bought");
    }
    onWatchChange();
  }

  return (
    <div className={`group border-b border-[#ece7de] hover:bg-white transition-colors ${anyWatched ? "border-l-2 border-l-[#e85d2f]" : ""}`}>
      <div className="flex items-start gap-0 px-4 pt-3 pb-2">
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
            <div className="font-sans font-black text-sm uppercase tracking-tight text-[#1a1a1a] leading-tight truncate">
              {show.title}
            </div>
            {show.subtitle && <div className="text-xs text-[#888] mt-0.5 truncate">{show.subtitle}</div>}
            {show.summary && <div className="text-[11px] text-[#888] mt-1 leading-relaxed line-clamp-2">{show.summary}</div>}
          </div>
        </a>
        <button onClick={handleBookmark}
          className="flex-shrink-0 p-1 hover:bg-[#ece7de] transition-colors mt-0.5 ml-2"
          title={anyWatched ? "Remove from watchlist" : "Add to watchlist"}
        >
          {anyWatched
            ? <IconBookmarkFilled size={15} className="text-[#e85d2f]" />
            : <IconBookmark size={15} className="text-[#d4c9b8] group-hover:text-[#888] transition-colors" />
          }
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-4 pb-3">
        {visible.map(({ id, date, status, time }) => {
          const d = new Date(date + "T00:00:00");
          const isToday = date === new Date().toISOString().slice(0, 10);
          const isCurrentYear = d.getFullYear() === new Date().getFullYear();
          const label = isToday ? "TODAY" : d.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", ...(!isCurrentYear && { year: "numeric" })
          }).toUpperCase();
          const chipStatus = watchMap[id];
          const isBought = chipStatus === "tickets_bought";
          const chipClass = isBought
            ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
            : status === "sold_out"
            ? "border-[#ece7de] text-[#ccc] line-through"
            : status === "few_left"
            ? "border-amber-300 text-amber-700"
            : "border-[#ece7de] text-[#888] hover:border-[#e85d2f] hover:text-[#e85d2f]";
          return (
            <div key={id} className="flex items-center gap-0.5">
              <a href={show.url} target="_blank" rel="noopener noreferrer"
                className={`text-[10px] font-bold px-2 py-0.5 border transition-colors tracking-wide ${chipClass}`}
              >
                {label}{time ? ` ${time.slice(0, 5)}` : ""}
              </a>
              {anyWatched && (
                <button onClick={(e) => handleMarkBought(e, id)}
                  title={isBought ? "Unmark as bought" : "Mark tickets bought"}
                  className={`p-0.5 transition-colors ${isBought ? "text-[#e85d2f]" : "text-[#d4c9b8] hover:text-[#888]"}`}
                >
                  <IconTicket size={11} />
                </button>
              )}
            </div>
          );
        })}
        {!expanded && hidden > 0 && (
          <button onClick={() => setExpanded(true)}
            className="text-[10px] font-bold px-2 py-0.5 border border-[#ece7de] text-[#aaa] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors tracking-wide"
          >+{hidden} MORE</button>
        )}
        {expanded && hidden > 0 && (
          <button onClick={() => setExpanded(false)}
            className="text-[10px] font-bold px-2 py-0.5 border border-[#ece7de] text-[#aaa] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors tracking-wide"
          >SHOW LESS</button>
        )}
      </div>
    </div>
  );
}

function VenueFilterSection({ groups, activeVenues, toggleVenue, selectAllInGroup, deselectAllInGroup, onSelectAll }: {
  groups: { priority: Priority; label: string; items: { id: string; name: string }[] }[];
  activeVenues: Set<string>;
  toggleVenue: (id: string) => void;
  selectAllInGroup: (ids: string[]) => void;
  deselectAllInGroup: (ids: string[]) => void;
  onSelectAll: () => void;
}) {
  const noneActive = activeVenues.size === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* All chip */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={onSelectAll}
          className={`text-xs px-2.5 py-1 border transition-colors ${noneActive ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
        >
          All
        </button>
      </div>
      {groups.map(({ priority, label, items }) => {
        const groupIds = items.map(i => i.id);
        const allSelected = groupIds.every(id => activeVenues.has(id));
        return (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-neutral-500 font-medium">{label}</span>
              <button
                onClick={() => allSelected ? deselectAllInGroup(groupIds) : selectAllInGroup(groupIds)}
                className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {allSelected ? "None" : "All"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map(({ id, name }) => (
                <button key={id} onClick={() => toggleVenue(id)}
                  className={`text-xs px-2.5 py-1 border transition-colors ${activeVenues.has(id) ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ShowFeed() {
  const [shows, setShows] = useState<Show[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [displayView, setDisplayView] = useState<DisplayView>("programme");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeVenues, setActiveVenues] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 75;

  const load = async () => {
    const [s, v, c, w] = await Promise.all([
      api.getUpcoming(2000, 0), api.getVenues(), api.getCompanies(), api.getWatchlist(),
    ]);
    setShows(s); setVenues(v); setCompanies(c); setWatchlist(w); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const venueMap = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const venueNameMap = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v.name])), [venues]);
  const watchMap = useMemo(
    () => Object.fromEntries(watchlist.map((w) => [w.show.id, w.watchlist.status as WatchStatus])),
    [watchlist]
  );

  const presentTypes = useMemo(() => {
    const s = new Set(shows.map((s) => s.type).filter(Boolean) as string[]);
    return ALL_TYPES.filter((t) => s.has(t));
  }, [shows]);

  const venueGroups = useMemo(() => {
    const order: Priority[] = ["high", "medium", "low"];
    return order.map(p => ({
      priority: p,
      label: PRIORITY_LABELS[p],
      items: venues
        .filter(v => v.priority === p)
        .map(v => ({ id: v.id, name: v.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(g => g.items.length > 0);
  }, [venues]);

  useEffect(() => { setPage(0); }, [timeframe, activeTypes, activeVenues, searchQuery]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let result = shows.filter((s) => {
      if (s.date > todayStr) return true;
      if (s.date < todayStr) return false;
      if (s.time) return s.time.slice(0, 5) > currentTime;
      return true;
    });

    if (timeframe === "today") {
      result = result.filter((s) => s.date === todayStr);
    } else if (timeframe === "week") {
      const end = endOfWeek();
      result = result.filter((s) => new Date(s.date + "T00:00:00") <= end);
    } else if (timeframe === "month") {
      const end = endOfMonth();
      result = result.filter((s) => new Date(s.date + "T00:00:00") <= end);
    }

    if (activeTypes.size > 0) {
      result = result.filter((s) => s.type && activeTypes.has(s.type));
    }

    if (activeVenues.size > 0) {
      result = result.filter((s) =>
        (s.venue_id && activeVenues.has(s.venue_id)) ||
        (s.company_id && activeVenues.has(s.company_id))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const venueName = (s.venue_id ? venueMap[s.venue_id]?.name : s.company_id ? companyMap[s.company_id]?.name : "") ?? "";
        return (
          s.title.toLowerCase().includes(q) ||
          (s.summary ?? "").toLowerCase().includes(q) ||
          venueName.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [shows, timeframe, activeTypes, activeVenues, searchQuery, venueMap, companyMap]);

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function toggleVenue(id: string) {
    setActiveVenues((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllInGroup(ids: string[]) {
    setActiveVenues((prev) => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }

  function deselectAllInGroup(ids: string[]) {
    setActiveVenues((prev) => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  function clearAll() {
    setTimeframe("week");
    setActiveTypes(new Set());
    setActiveVenues(new Set());
    setSearchQuery("");
  }

  const hasFilters = timeframe !== "all" || activeTypes.size > 0 || activeVenues.size > 0 || !!searchQuery.trim();
  const filterCount = (timeframe !== "all" ? 1 : 0) + (activeTypes.size > 0 ? 1 : 0) + (activeVenues.size > 0 ? 1 : 0);

  // Programme view: group all shows by title+venue, keeping all dates
  const programmeGroups = useMemo(() => {
    const map = new Map<string, { show: Show; allDates: DateEntry[] }>();
    for (const show of filtered) {
      const key = `${show.title.toLowerCase().trim()}||${show.venue_id ?? show.company_id ?? ""}`;
      const entry: DateEntry = { id: show.id, date: show.date, status: show.ticket_status ?? "available", time: show.time ?? undefined };
      if (!map.has(key)) {
        map.set(key, { show, allDates: [entry] });
      } else {
        map.get(key)!.allDates.push(entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.allDates[0].date.localeCompare(b.allDates[0].date));
  }, [filtered]);

  const pagedProgramme = useMemo(
    () => programmeGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [programmeGroups, page]
  );
  const pagedAgenda = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  const totalPages = Math.ceil(
    (displayView === "programme" ? programmeGroups.length : filtered.length) / PAGE_SIZE
  );

  const groups = pagedAgenda.reduce<Record<string, Record<string, Show[]>>>((acc, show) => {
    const d = new Date(show.date + "T00:00:00");
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const dayKey = show.date;
    if (!acc[monthKey]) acc[monthKey] = {};
    if (!acc[monthKey][dayKey]) acc[monthKey][dayKey] = [];
    acc[monthKey][dayKey].push(show);
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-neutral-300 text-sm tracking-widest uppercase">Loading…</div>;
  }

  return (
    <div>
      {/* Top bar: Filter button + view toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsFilterOpen((o) => !o)}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 border transition-colors ${isFilterOpen ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
        >
          <IconAdjustmentsHorizontal size={13} />
          Filter
          {filterCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 font-medium ${isFilterOpen ? "bg-white text-neutral-900" : "bg-[#1a1a1a] text-white"}`}>
              {filterCount}
            </span>
          )}
        </button>

        <div className="flex items-center border border-[#ece7de] overflow-hidden">
          {([
            { key: "programme", label: "Programme", icon: <IconLayoutGrid size={13} /> },
            { key: "agenda",    label: "Agenda",    icon: <IconList size={13} /> },
            { key: "calendar",  label: "Calendar",  icon: <IconCalendar size={13} /> },
          ] as { key: DisplayView; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setDisplayView(key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 transition-colors ${displayView === key ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#e85d2f] pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events, artists, venues…"
          className="w-full pl-8 pr-8 py-2 text-sm border border-[#d4c9b8] bg-[#eceae4] placeholder-[#aaa] text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <IconX size={13} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {isFilterOpen && (
        <div className="border border-[#ece7de] p-4 mb-5 flex flex-col gap-5 bg-[#eceae4]">

          {/* When */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">When</div>
            <div className="flex items-center border border-[#ece7de] overflow-hidden w-fit">
              {(["today", "week", "month", "all"] as Timeframe[]).map((t) => (
                <button key={t} onClick={() => setTimeframe(t)}
                  className={`text-xs px-3 py-1.5 transition-colors ${timeframe === t ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
                >
                  {t === "today" ? "Today" : t === "week" ? "This week" : t === "month" ? "This month" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Type</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveTypes(new Set())}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border transition-colors ${activeTypes.size === 0 ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
              >
                All
              </button>
              {presentTypes.map((type) => (
                <button key={type} onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border transition-colors ${activeTypes.has(type) ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
                >
                  <EventTypeIcon type={type} size={11} />
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Venues */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Venues</div>
            <VenueFilterSection
              groups={venueGroups}
              activeVenues={activeVenues}
              toggleVenue={toggleVenue}
              selectAllInGroup={selectAllInGroup}
              deselectAllInGroup={deselectAllInGroup}
              onSelectAll={() => setActiveVenues(new Set())}
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <div className="pt-1 border-t border-neutral-100">
              <button onClick={clearAll} className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results count when filtered */}
      {hasFilters && (
        <div className="text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
          {filtered.length} show{filtered.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Calendar view */}
      {displayView === "calendar" ? (
        <CalendarBody shows={filtered} venueMap={venueNameMap} />
      ) : displayView === "programme" ? (
        programmeGroups.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">No shows match these filters.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {pagedProgramme.map(({ show, allDates }) => {
              const location = show.venue_id ? venueMap[show.venue_id]?.name : show.company_id ? companyMap[show.company_id]?.name : "";
              return (
                <ProgrammeCard
                  key={`${show.title}||${show.venue_id ?? show.company_id}`}
                  show={show}
                  allDates={allDates}
                  location={location ?? ""}
                  watchMap={watchMap}
                  onWatchChange={load}
                />
              );
            })}
          </div>
        )
      ) : (
        filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">No shows match these filters.</div>
        ) : (
          Object.entries(groups).map(([monthKey, dayGroups]) => {
            const [year, month] = monthKey.split("-");
            const totalShows = Object.values(dayGroups).reduce((n, s) => n + s.length, 0);
            return (
              <div key={monthKey} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">
                    {MONTH_NAMES[parseInt(month)]} {year}
                  </span>
                  <span className="text-[10px] text-neutral-300">{totalShows}</span>
                  <div className="flex-1 h-px bg-neutral-100" />
                </div>
                {Object.entries(dayGroups).map(([dayKey, dayShows], i) => {
                  const d = new Date(dayKey + "T00:00:00");
                  const isToday = dayKey === new Date().toISOString().slice(0, 10);
                  const dayLabel = isToday
                    ? "Today"
                    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
                  return (
                    <div key={dayKey}>
                      {i > 0 && <div className="h-px bg-neutral-100 my-3" />}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[11px] uppercase tracking-widest ${isToday ? "text-neutral-700 font-medium" : "text-neutral-400"}`}>
                          {dayLabel}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {dayShows.map((show) => (
                          <ShowCard
                            key={show.id}
                            show={show}
                            venueName={show.venue_id ? venueMap[show.venue_id]?.name : undefined}
                            companyName={show.company_id ? companyMap[show.company_id]?.name : undefined}
                            watchStatus={watchMap[show.id]}
                            onWatchChange={load}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6 pb-2">
          <button
            onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}
            disabled={page === 0}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-neutral-400">{page + 1} / {totalPages}</span>
          <button
            onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}
            disabled={page >= totalPages - 1}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
