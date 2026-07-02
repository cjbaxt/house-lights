import { useState } from "react";
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import type { Show, WatchStatus } from "../lib/api";
import { api } from "../lib/api";
import WatchMenu from "./WatchMenu";
import EventTypeIcon from "./EventTypeIcon";

interface Props {
  show: Show;
  venueName?: string;
  companyName?: string;
  watchStatus?: WatchStatus;
  onWatchChange?: () => void;
  extraDates?: number;
}

const TICKET_BADGE: Record<string, string> = {
  available: "bg-neutral-50 border border-neutral-200 text-neutral-500",
  few_left: "bg-amber-50 border border-amber-100 text-amber-700",
  sold_out: "bg-neutral-50 border border-neutral-200 text-neutral-400 line-through",
};

const TICKET_LABEL: Record<string, string> = {
  available: "tickets",
  few_left: "few left",
  sold_out: "sold out",
};

export default function ShowCard({ show, venueName, companyName, watchStatus, onWatchChange, extraDates }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const date = new Date(show.date + "T00:00:00");
  const day = date.getDate();
  const monthShort = date.toLocaleString("en-GB", { month: "short" });
  const location = venueName || companyName || "";
  const isWatched = watchStatus && watchStatus !== "passed";

  return (
    <div className="relative w-full text-left bg-white border border-neutral-100 rounded-xl flex items-stretch hover:border-neutral-300 transition-colors group">
      {/* Clickable main area → venue site */}
      <a
        href={show.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3"
      >
        {/* thumbnail or type icon */}
        {show.image_url ? (
          <div className="w-12 md:w-20 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100" style={{ aspectRatio: "4/3" }}>
            <img
              src={show.image_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        ) : (
          <div className="w-12 md:w-20 border border-neutral-200 rounded-lg flex items-center justify-center flex-shrink-0 text-neutral-400 group-hover:text-neutral-600 transition-colors" style={{ aspectRatio: "4/3" }}>
            <EventTypeIcon type={show.type} size={14} />
          </div>
        )}

        {/* main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-neutral-400 flex-shrink-0" title={show.type ?? "other"}><EventTypeIcon type={show.type} size={13} /></span>
            <span className="font-serif text-sm md:text-base font-medium text-neutral-900 md:truncate line-clamp-2 md:line-clamp-none">{show.title}</span>
          </div>
          {show.subtitle && (
            <div className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{show.subtitle}</div>
          )}
          <div className="text-xs text-neutral-400 mt-0.5 truncate">{location}</div>
          {show.summary && (
            <div className="text-[11px] text-neutral-400 mt-1 leading-relaxed line-clamp-3 md:line-clamp-2">{show.summary}</div>
          )}
        </div>

        {/* right side meta */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="text-xs text-neutral-400">{day} {monthShort}</div>
          {show.time && (
            <div className="text-[11px] text-neutral-300">{show.time.slice(0, 5)}</div>
          )}
          {extraDates && extraDates > 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-neutral-400">
              +{extraDates} dates
            </span>
          ) : show.ticket_status && TICKET_LABEL[show.ticket_status] ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${TICKET_BADGE[show.ticket_status] || ""}`}>
              {TICKET_LABEL[show.ticket_status]}
            </span>
          ) : null}
          {show.price_from && (
            <span className="text-[11px] text-neutral-300">from €{show.price_from}</span>
          )}
        </div>
      </a>

      {/* bookmark — separate from the link */}
      <div className="relative flex-shrink-0 flex items-center pr-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          {isWatched ? (
            <IconBookmarkFilled size={15} className="text-neutral-700" />
          ) : (
            <IconBookmark size={15} className="text-neutral-200 group-hover:text-neutral-400 transition-colors" />
          )}
        </button>
        {menuOpen && (
          <WatchMenu
            showId={show.id}
            current={watchStatus}
            onSelect={async (status) => {
              if (status === null) await api.removeWatch(show.id);
              else await api.upsertWatch(show.id, status);
              setMenuOpen(false);
              onWatchChange?.();
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
