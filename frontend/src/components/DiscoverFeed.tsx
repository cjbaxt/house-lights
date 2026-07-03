import { useState, useEffect } from "react";
import { IconSearch, IconX, IconSparkles, IconList, IconCalendar } from "@tabler/icons-react";
import { api } from "../lib/api";
import type { Show, Venue, Company, WatchlistEntry, WatchStatus } from "../lib/api";
import ShowCard from "./ShowCard";
import CalendarBody from "./CalendarBody";

type DisplayView = "list" | "calendar";

const SUGGESTIONS = [
  "experimental electronic music",
  "something theatrical and emotional",
  "jazz or improvised music",
  "comedy tonight",
  "classical concert",
  "dance performance",
];

export default function DiscoverFeed({ isStatic = false }: { isStatic?: boolean }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [displayView, setDisplayView] = useState<DisplayView>("list");

  useEffect(() => {
    Promise.all([api.getVenues(), api.getCompanies(), api.getWatchlist()]).then(([v, c, w]) => {
      setVenues(v); setCompanies(c); setWatchlist(w);
    });
  }, []);

  const venueMap = Object.fromEntries(venues.map((v) => [v.id, v.name]));
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const watchMap = Object.fromEntries(watchlist.map((w) => [w.show.id, w.watchlist.status as WatchStatus]));

  async function search(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setSearched(true);
    const shows = await api.getRecommended(q, 20);
    setResults(shows);
    setLoading(false);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  async function reload() {
    const [v, c, w] = await Promise.all([api.getVenues(), api.getCompanies(), api.getWatchlist()]);
    setVenues(v); setCompanies(c); setWatchlist(w);
  }

  if (isStatic) {
    return (
      <div className="mt-8 text-sm text-neutral-500 leading-relaxed space-y-3">
        <p>Mood search isn't available in the deployed version yet — it runs against a local AI model that isn't in the cloud.</p>
        <p><a href={`${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/about`} className="underline underline-offset-2 hover:text-neutral-800 transition-colors">Read more about what's planned</a></p>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <IconSparkles size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#e85d2f] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(query)}
            placeholder="What are you in the mood for?"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-[#eceae4] border border-[#d4c9b8] focus:outline-none focus:border-[#1a1a1a] transition-colors placeholder:text-[#aaa] text-[#1a1a1a]"
          />
        </div>
        {searched ? (
          <button onClick={clear} className="p-2.5 border border-[#d4c9b8] bg-[#eceae4] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors text-[#888]">
            <IconX size={15} />
          </button>
        ) : (
          <button onClick={() => search(query)} disabled={!query.trim()}
            className="p-2.5 border border-[#d4c9b8] bg-[#eceae4] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors text-[#888] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <IconSearch size={15} />
          </button>
        )}
      </div>

      {/* Suggestion chips */}
      {!searched && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => search(s)}
                className="text-[9px] px-3 py-1 border border-[#d4c9b8] bg-[#eceae4] text-[#555] font-bold uppercase tracking-wider hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed mb-6">
            Experimental — uses semantic search to match your description to show descriptions. Works best for genre or mood queries. Less reliable for things like "suitable for kids" or specific age groups.
          </p>
        </>
      )}

      {/* Results */}
      {searched && (
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <IconSparkles size={14} className="animate-pulse" />
              Finding shows…
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-neutral-400">No matching shows found.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <IconSparkles size={13} className="text-neutral-400" />
                <span className="flex-1 text-[11px] uppercase tracking-widest text-neutral-400">
                  {results.length} shows matching "{query}"
                </span>
                {/* View toggle */}
                <div className="flex items-center border border-[#ece7de] overflow-hidden">
                  <button onClick={() => setDisplayView("list")}
                    className={`p-1.5 transition-colors ${displayView === "list" ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
                    title="List view"
                  >
                    <IconList size={14} />
                  </button>
                  <button onClick={() => setDisplayView("calendar")}
                    className={`p-1.5 transition-colors ${displayView === "calendar" ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
                    title="Calendar view"
                  >
                    <IconCalendar size={14} />
                  </button>
                </div>
              </div>

              {displayView === "calendar" ? (
                <CalendarBody shows={results} venueMap={venueMap} />
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((show) => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      venueName={show.venue_id ? venueMap[show.venue_id] : undefined}
                      companyName={show.company_id ? companyMap[show.company_id] : undefined}
                      watchStatus={watchMap[show.id]}
                      onWatchChange={reload}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
