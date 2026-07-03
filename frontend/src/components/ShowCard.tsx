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
  available: "border border-[#ece7de] text-[#aaa]",
  few_left: "border border-amber-200 text-amber-700",
  sold_out: "border border-[#ece7de] text-[#ccc] line-through",
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
  const monthShort = date.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const location = venueName || companyName || "";
  const isWatched = watchStatus && watchStatus !== "passed";

  return (
    <div className={`relative w-full text-left flex items-stretch border-b border-[#ece7de] group transition-colors hover:bg-white ${isWatched ? "border-l-2 border-l-[#e85d2f] pl-0" : ""}`}>
      <a
        href={show.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 flex-1 min-w-0 px-4 py-3"
      >
        {/* Date block */}
        <div className="flex-shrink-0 w-10 text-center">
          <div className="text-xl font-black leading-none text-[#e85d2f]">{day}</div>
          <div className="text-[9px] font-bold tracking-widest text-[#bbb] mt-0.5">{monthShort}</div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-[#ece7de] flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold tracking-widest text-[#e85d2f] uppercase mb-0.5">
            {show.type ?? "other"}{location ? ` · ${location}` : ""}
          </div>
          <div className="font-sans font-bold text-sm text-[#1a1a1a] uppercase tracking-tight leading-tight md:truncate line-clamp-2 md:line-clamp-none">
            {show.title}
          </div>
          {show.subtitle && (
            <div className="text-xs text-[#888] mt-0.5 truncate">{show.subtitle}</div>
          )}
        </div>

        {/* Right meta */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {show.time && (
            <div className="text-xs font-bold text-[#1a1a1a]">{show.time.slice(0, 5)}</div>
          )}
          {extraDates && extraDates > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 border border-[#ece7de] text-[#aaa]">
              +{extraDates} dates
            </span>
          ) : show.ticket_status && TICKET_LABEL[show.ticket_status] ? (
            <span className={`text-[10px] px-1.5 py-0.5 ${TICKET_BADGE[show.ticket_status] || ""}`}>
              {TICKET_LABEL[show.ticket_status]}
            </span>
          ) : null}
        </div>
      </a>

      {/* Bookmark */}
      <div className="relative flex-shrink-0 flex items-center pr-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="p-1 hover:bg-[#ece7de] transition-colors"
        >
          {isWatched
            ? <IconBookmarkFilled size={15} className="text-[#e85d2f]" />
            : <IconBookmark size={15} className="text-[#d4c9b8] group-hover:text-[#888] transition-colors" />
          }
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
