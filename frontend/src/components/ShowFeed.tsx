import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type React from "react";
import { IconList, IconCalendar, IconLayoutGrid, IconAdjustmentsHorizontal, IconBookmark, IconBookmarkFilled, IconTicket, IconSearch, IconX } from "@tabler/icons-react";
import { api } from "../lib/api";
import type { Show, Venue, City, WatchlistEntry, WatchStatus } from "../lib/api";
import ShowCard from "./ShowCard";
import CalendarBody from "./CalendarBody";
import EventTypeIcon from "./EventTypeIcon";
import ExpandableText from "./ExpandableText";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Timeframe = "today" | "week" | "month" | "all" | "custom";
type Priority = "high" | "medium" | "low";
type DisplayView = "programme" | "agenda" | "calendar";

const ALL_TYPES = ["music", "classical", "theatre", "comedy", "ballet", "dance", "opera", "other"];
const PRIORITY_LABELS: Record<Priority, string> = { high: "Regular", medium: "Occasional", low: "Exploring" };

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function endOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return localDateStr(d);
}

function endOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return localDateStr(d);
}

const CHIP_LIMIT = 5;
const PROGRAMME_FETCH_SIZE = 150;

type DateEntry = { id: string; date: string; status: string; time?: string };

function ProgrammeCard({ show, allDates, location, watchMap, onWatchChange, currentUser }: {
  show: Show;
  allDates: DateEntry[];
  location: string;
  watchMap: Record<string, WatchStatus>;
  onWatchChange: () => void;
  currentUser: { id: string } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? allDates : allDates.slice(0, CHIP_LIMIT);
  const hidden = allDates.length - CHIP_LIMIT;
  const anyWatched = allDates.some(d => watchMap[d.id] && watchMap[d.id] !== "passed");

  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (!currentUser) { window.location.href = "/login?message=" + encodeURIComponent("Sign up or log in to add things to your watchlist."); return; }
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
    if (!currentUser) { window.location.href = "/login?message=" + encodeURIComponent("Sign up or log in to add things to your watchlist."); return; }
    const current = watchMap[showId];
    await api.upsertWatch(showId, current === "tickets_bought" ? "interested" : "tickets_bought");
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
            {show.subtitle && <div className="text-xs text-[#888] mt-0.5 line-clamp-2">{show.subtitle}</div>}
            {show.summary && <ExpandableText text={show.summary} className="text-[11px] text-[#888] mt-1 leading-relaxed" lines={2} />}
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
          const isToday = date === localDateStr();
          const isCurrentYear = d.getFullYear() === new Date().getFullYear();
          const label = isToday ? "TODAY" : d.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", ...(!isCurrentYear && { year: "numeric" })
          }).toUpperCase();
          const chipStatus = watchMap[id];
          const isBought = chipStatus === "tickets_bought";
          const chipClass = isBought
            ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
            : status === "sold_out" ? "border-[#ece7de] text-[#ccc] line-through"
            : status === "few_left" ? "border-amber-300 text-amber-700"
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
      <div className="flex flex-wrap gap-1.5">
        <button onClick={onSelectAll}
          className={`text-xs px-2.5 py-1 border transition-colors ${noneActive ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
        >All</button>
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
  const [total, setTotal] = useState(0);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(0);
  const [displayView, setDisplayView] = useState<DisplayView>("programme");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeVenues, setActiveVenues] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(20);

  const searchRef = useRef<HTMLInputElement>(null);
  const defaultsInitialized = useRef(false);
  const fetchController = useRef<AbortController | null>(null);

  // Build URL params for the /api/shows endpoint
  const buildShowsUrl = useCallback((pg: number, limit: number) => {
    const url = new URL("/api/shows", window.location.origin);
    url.searchParams.set("page", String(pg));
    url.searchParams.set("limit", String(limit));

    const today = localDateStr();
    if (timeframe === "today") {
      url.searchParams.set("from_date", today);
      url.searchParams.set("to_date", today);
    } else if (timeframe === "week") {
      url.searchParams.set("from_date", today);
      url.searchParams.set("to_date", endOfWeek());
    } else if (timeframe === "month") {
      url.searchParams.set("from_date", today);
      url.searchParams.set("to_date", endOfMonth());
    } else if (timeframe === "custom") {
      if (dateFrom) url.searchParams.set("from_date", dateFrom);
      if (dateTo) url.searchParams.set("to_date", dateTo);
    } else {
      // "all" — just set from today
      url.searchParams.set("from_date", today);
    }

    if (activeTypes.size > 0) url.searchParams.set("types", [...activeTypes].join(","));
    if (activeVenues.size > 0) url.searchParams.set("venue_ids", [...activeVenues].join(","));
    if (activeCityId) url.searchParams.set("city_id", activeCityId);
    return url;
  }, [timeframe, dateFrom, dateTo, activeTypes, activeVenues, activeCityId]);

  const fetchShows = useCallback(async (pg: number) => {
    if (fetchController.current) fetchController.current.abort();
    fetchController.current = new AbortController();

    const limit = displayView === "programme" ? PROGRAMME_FETCH_SIZE : pageSize;
    const url = buildShowsUrl(pg, limit);

    try {
      setFetching(true);
      const resp = await fetch(url, { signal: fetchController.current.signal });
      const data = await resp.json();
      setShows(data.shows ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") console.error(e);
    } finally {
      setFetching(false);
    }
  }, [buildShowsUrl, displayView, pageSize]);

  const loadWatchlist = useCallback(async () => {
    const wl = await api.getWatchlist();
    setWatchlist(wl);
  }, []);

  // Initial load: user, venues, watchlist, then shows
  useEffect(() => {
    (async () => {
      const supabase = (await import("../lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user ? { id: user.id } : null);

      const [v, w, allCities, userCityIds] = await Promise.all([
        api.getVenues(),
        user ? api.getWatchlist() : Promise.resolve([]),
        api.getCities(),
        user ? api.getUserCities() : Promise.resolve([]),
      ]);
      setVenues(v);
      setWatchlist(w);
      setCities(allCities);

      if (!defaultsInitialized.current) {
        defaultsInitialized.current = true;
        setActiveVenues(new Set(v.filter(x => x.priority === "high").map(x => x.id)));
        // Default to first user city, or first active city for logged-out
        const defaultCity = userCityIds.length > 0
          ? allCities.find(c => c.id === userCityIds[0])
          : allCities.find(c => c.is_active);
        if (defaultCity) setActiveCityId(defaultCity.id);
      }

      setLoading(false);
    })();
  }, []);

  // Re-fetch shows when filters, page, or view changes (but not on initial load)
  useEffect(() => {
    if (loading) return;
    fetchShows(page);
  }, [loading, fetchShows, page]);

  // Reset to page 0 when filters change
  useEffect(() => {
    if (loading) return;
    setPage(0);
  }, [timeframe, dateFrom, dateTo, activeTypes, activeVenues, activeCityId, displayView, pageSize]);

  const venueMap = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const venueNameMap = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v.name])), [venues]);
  const watchMap = useMemo(
    () => Object.fromEntries(watchlist.map((w) => [w.show.id, w.watchlist.status as WatchStatus])),
    [watchlist]
  );

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

  // Local search filter over fetched shows
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return shows;
    const q = searchQuery.toLowerCase().trim();
    return shows.filter((s) => {
      const venueName = s.venue_id ? (venueMap[s.venue_id]?.name ?? "") : "";
      return (
        s.title.toLowerCase().includes(q) ||
        (s.summary ?? "").toLowerCase().includes(q) ||
        venueName.toLowerCase().includes(q)
      );
    });
  }, [shows, searchQuery, venueMap]);

  // Programme view: group by title+venue
  const programmeGroups = useMemo(() => {
    const map = new Map<string, { show: Show; allDates: DateEntry[] }>();
    for (const show of filtered) {
      const key = `${show.title.toLowerCase().trim()}||${show.venue_id ?? ""}`;
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
    () => programmeGroups.slice(page * pageSize, (page + 1) * pageSize),
    [programmeGroups, page, pageSize]
  );
  const pagedAgenda = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

  const totalPages = displayView === "programme"
    ? Math.ceil(programmeGroups.length / pageSize)
    : Math.ceil(total / pageSize);

  const groups = pagedAgenda.reduce<Record<string, Record<string, Show[]>>>((acc, show) => {
    const d = new Date(show.date + "T00:00:00");
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const dayKey = show.date;
    if (!acc[monthKey]) acc[monthKey] = {};
    if (!acc[monthKey][dayKey]) acc[monthKey][dayKey] = [];
    acc[monthKey][dayKey].push(show);
    return acc;
  }, {});

  function toggleType(type: string) {
    setActiveTypes((prev) => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; });
  }
  function toggleVenue(id: string) {
    setActiveVenues((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAllInGroup(ids: string[]) {
    setActiveVenues((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
  }
  function deselectAllInGroup(ids: string[]) {
    setActiveVenues((prev) => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
  }
  function clearAll() {
    setTimeframe("month");
    setDateFrom(""); setDateTo("");
    setActiveTypes(new Set());
    setActiveVenues(new Set(venues.filter(x => x.priority === "high").map(x => x.id)));
    setSearchQuery("");
    const defaultCity = cities.find(c => c.is_active);
    setActiveCityId(defaultCity?.id ?? null);
  }

  const activeCities = cities.filter(c => c.is_active);
  const hasFilters = timeframe !== "all" || activeTypes.size > 0 || activeVenues.size > 0 || !!searchQuery.trim() || (activeCities.length > 1 && activeCityId !== null);
  const filterCount = (timeframe !== "all" ? 1 : 0) + (activeTypes.size > 0 ? 1 : 0) + (activeVenues.size > 0 ? 1 : 0) + (activeCities.length > 1 && activeCityId !== null ? 1 : 0);

  const displayCount = displayView === "programme" ? programmeGroups.length : filtered.length;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-neutral-300 text-sm tracking-widest uppercase">Loading…</div>;
  }

  return (
    <div>
      {/* Top bar */}
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

      {/* Search */}
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
          <button onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <IconX size={13} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {isFilterOpen && (
        <div className="border border-[#ece7de] p-4 mb-5 flex flex-col gap-5 bg-[#eceae4]">
          {cities.filter(c => c.is_active).length > 1 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">City</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveCityId(null)}
                  className={`text-xs px-2.5 py-1 border transition-colors ${activeCityId === null ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
                >All</button>
                {cities.filter(c => c.is_active).map(city => (
                  <button key={city.id} onClick={() => setActiveCityId(city.id)}
                    className={`text-xs px-2.5 py-1 border transition-colors ${activeCityId === city.id ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
                  >{city.name}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">When</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center border border-[#ece7de] overflow-hidden">
                {(["today", "week", "month", "all"] as Timeframe[]).map((t) => (
                  <button key={t} onClick={() => setTimeframe(t)}
                    className={`text-xs px-3 py-1.5 transition-colors ${timeframe === t ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
                  >
                    {t === "today" ? "Today" : t === "week" ? "This week" : t === "month" ? "This month" : "All"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setTimeframe("custom")}
                className={`text-xs px-3 py-1.5 border transition-colors ${timeframe === "custom" ? "bg-[#1a1a1a] border-[#1a1a1a] text-white" : "border-[#ece7de] text-[#888] hover:bg-[#ece7de]"}`}
              >
                Custom
              </button>
            </div>
            {timeframe === "custom" && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs border border-[#d4c9b8] bg-white px-2 py-1.5 text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] transition-colors" />
                <span className="text-[#aaa] text-xs">to</span>
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs border border-[#d4c9b8] bg-white px-2 py-1.5 text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] transition-colors" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[#aaa] hover:text-[#666] transition-colors">
                    <IconX size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Type</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveTypes(new Set())}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border transition-colors ${activeTypes.size === 0 ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
              >All</button>
              {ALL_TYPES.map((type) => (
                <button key={type} onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border transition-colors ${activeTypes.has(type) ? "bg-[#1a1a1a] border-[#e85d2f] text-white" : "border-[#ece7de] text-[#888] hover:border-[#d4c9b8]"}`}
                >
                  <EventTypeIcon type={type} size={11} />
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

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

          {hasFilters && (
            <div className="pt-1 border-t border-neutral-100">
              <button onClick={clearAll} className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results count + page size */}
      <div className="flex items-center justify-between mb-3">
        <div className={`text-[11px] uppercase tracking-widest transition-opacity ${fetching ? "opacity-40" : "opacity-100"} text-neutral-400`}>
          {displayCount} show{displayCount !== 1 ? "s" : ""}
          {total > shows.length && displayView !== "programme" && (
            <span className="text-neutral-300"> of {total}</span>
          )}
        </div>
        {displayView !== "calendar" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-300 uppercase tracking-widest">Per page</span>
            <div className="flex items-center border border-[#ece7de] overflow-hidden">
              {[10, 20, 50].map((n) => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={`text-[11px] px-2 py-1 transition-colors ${pageSize === n ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendar */}
      {displayView === "calendar" ? (
        <CalendarBody shows={filtered} venueMap={venueNameMap} />
      ) : displayView === "programme" ? (
        programmeGroups.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">No shows match these filters.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {pagedProgramme.map(({ show, allDates }) => {
              const location = show.venue_id ? venueMap[show.venue_id]?.name : "";
              return (
                <ProgrammeCard
                  key={`${show.title}||${show.venue_id ?? ""}`}
                  show={show}
                  allDates={allDates}
                  location={location ?? ""}
                  watchMap={watchMap}
                  onWatchChange={loadWatchlist}
                  currentUser={currentUser}
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
                  const isToday = dayKey === localDateStr();
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
                            watchStatus={watchMap[show.id]}
                            onWatchChange={loadWatchlist}
                            currentUser={currentUser}
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
        <div className="flex items-center justify-center gap-1 pt-6 pb-2">
          <button onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}
            disabled={page === 0}
            className="text-xs px-2.5 py-1.5 border border-[#ece7de] text-[#888] hover:bg-[#ece7de] transition-colors disabled:opacity-30"
          >←</button>
          {Array.from({ length: totalPages }, (_, i) => i).map((i) => {
            const near = Math.abs(i - page) <= 2 || i === 0 || i === totalPages - 1;
            const ellipsisBefore = i === page - 3 && page > 3;
            const ellipsisAfter = i === page + 3 && page < totalPages - 4;
            if (ellipsisBefore || ellipsisAfter) return <span key={i} className="text-xs text-neutral-300 px-1">…</span>;
            if (!near) return null;
            return (
              <button key={i} onClick={() => { setPage(i); window.scrollTo(0, 0); }}
                className={`text-xs px-2.5 py-1.5 border transition-colors ${page === i ? "bg-[#1a1a1a] border-[#1a1a1a] text-white" : "border-[#ece7de] text-[#888] hover:bg-[#ece7de]"}`}
              >
                {i + 1}
              </button>
            );
          })}
          <button onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}
            disabled={page >= totalPages - 1}
            className="text-xs px-2.5 py-1.5 border border-[#ece7de] text-[#888] hover:bg-[#ece7de] transition-colors disabled:opacity-30"
          >→</button>
        </div>
      )}
    </div>
  );
}
