import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { Show } from "../lib/api";
import EventTypeIcon from "./EventTypeIcon";

type ViewMode = "month" | "week" | "day";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0,0,0,0);
  return s;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function EventChip({ show, venueName, compact = false }: { show: Show; venueName?: string; compact?: boolean }) {
  return (
    <a
      href={show.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1 border border-[#ece7de] hover:border-[#e85d2f] hover:bg-white transition-colors group ${compact ? "px-1.5 py-0.5" : "px-2 py-1"}`}
      title={`${show.title}${venueName ? ` — ${venueName}` : ""}`}
    >
      <span className="text-[#e85d2f] flex-shrink-0">
        <EventTypeIcon type={show.type} size={compact ? 10 : 12} />
      </span>
      <span className={`truncate text-[#1a1a1a] font-bold uppercase tracking-tight ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {show.title}
      </span>
      {!compact && show.time && (
        <span className="text-[10px] text-[#888] flex-shrink-0">{show.time.slice(0,5)}</span>
      )}
    </a>
  );
}

function MonthView({ anchor, showsByDate, venueMap }: { anchor: Date; showsByDate: Map<string, Show[]>; venueMap: Record<string, string> }) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastOfMonth.getDate()) / 7) * 7;
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) cells.push(addDays(firstOfMonth, i - startPad));
  const today = new Date();

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider text-[#aaa] font-bold py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-[#ece7de] border border-[#ece7de] overflow-hidden">
        {cells.map((cell, i) => {
          const inMonth = cell.getMonth() === month;
          const isToday = sameDay(cell, today);
          const dayShows = showsByDate.get(isoDate(cell)) ?? [];
          return (
            <div key={i} className={`bg-[#f5f3ef] min-h-[80px] p-1 ${!inMonth ? "opacity-40" : ""}`}>
              <div className={`text-[11px] font-medium mb-1 w-5 h-5 flex items-center justify-center ${isToday ? "bg-[#e85d2f] text-white" : "text-[#888]"}`}>
                {cell.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayShows.slice(0, 3).map(show => <EventChip key={show.id} show={show} venueName={venueMap[show.venue_id ?? ""]} compact />)}
                {dayShows.length > 3 && <span className="text-[9px] text-[#aaa] pl-1">+{dayShows.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ anchor, showsByDate, venueMap }: { anchor: Date; showsByDate: Map<string, Show[]>; venueMap: Record<string, string> }) {
  const monday = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = new Date();

  return (
    <div className="flex flex-col gap-1">
      {days.map((day, i) => {
        const isToday = sameDay(day, today);
        const dayShows = showsByDate.get(isoDate(day)) ?? [];
        return (
          <div key={i} className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-16 pt-1.5 text-right">
              <div className={`text-[9px] uppercase tracking-wider font-bold ${isToday ? "text-[#e85d2f]" : "text-[#aaa]"}`}>{DAYS[i]}</div>
              <div className={`text-sm ${isToday ? "text-[#e85d2f] font-black" : "text-[#aaa] font-medium"}`}>{day.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0 py-1 border-t border-[#ece7de]">
              {dayShows.length === 0
                ? <span className="text-[11px] text-[#d4c9b8]">—</span>
                : <div className="flex flex-col gap-1 pt-0.5">
                    {dayShows.map(show => <EventChip key={show.id} show={show} venueName={venueMap[show.venue_id ?? ""]} />)}
                  </div>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ anchor, showsByDate, venueMap }: { anchor: Date; showsByDate: Map<string, Show[]>; venueMap: Record<string, string> }) {
  const dayShows = showsByDate.get(isoDate(anchor)) ?? [];
  if (!dayShows.length) return (
    <div className="flex items-center justify-center h-32 text-[#aaa] text-sm">No shows on this day.</div>
  );

  return (
    <div className="flex flex-col gap-0">
      {dayShows.map(show => (
        <a key={show.id} href={show.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 border-b border-[#ece7de] px-4 py-3.5 hover:bg-white transition-colors group"
        >
          {show.time
            ? <div className="text-sm font-bold text-[#888] flex-shrink-0 w-10 text-right">{show.time.slice(0,5)}</div>
            : <div className="w-10 flex-shrink-0" />
          }
          <div className="w-px h-8 bg-[#ece7de] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-sans text-sm font-black uppercase tracking-tight text-[#1a1a1a] truncate">{show.title}</div>
            {show.subtitle && <div className="text-xs text-[#888] mt-0.5 truncate">{show.subtitle}</div>}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[#e85d2f]"><EventTypeIcon type={show.type} size={11} /></span>
              {venueMap[show.venue_id ?? ""] && <span className="text-xs text-[#888]">{venueMap[show.venue_id ?? ""]}</span>}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

interface Props {
  shows: Show[];
  venueMap: Record<string, string>;
  defaultView?: ViewMode;
}

export default function CalendarBody({ shows, venueMap, defaultView = "month" }: Props) {
  const [calView, setCalView] = useState<ViewMode>(defaultView);
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  const showsByDate = new Map<string, Show[]>();
  for (const show of shows) {
    const existing = showsByDate.get(show.date) ?? [];
    existing.push(show);
    showsByDate.set(show.date, existing);
  }

  function navigate(dir: -1 | 1) {
    setAnchor(prev => {
      const d = new Date(prev);
      if (calView === "month") { d.setMonth(d.getMonth() + dir); d.setDate(1); }
      else if (calView === "week") { d.setDate(d.getDate() + dir * 7); }
      else { d.setDate(d.getDate() + dir); }
      return d;
    });
  }

  function goToday() { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); }

  function headerLabel() {
    if (calView === "month") return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (calView === "week") {
      const mon = startOfWeek(anchor);
      const sun = addDays(mon, 6);
      const same = mon.getMonth() === sun.getMonth();
      return same
        ? `${mon.getDate()}–${sun.getDate()} ${MONTHS[mon.getMonth()]} ${mon.getFullYear()}`
        : `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
    }
    return `${anchor.getDate()} ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goToday}
          className="text-xs border border-[#ece7de] px-3 py-1.5 text-[#888] hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors"
        >Today</button>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-[#ece7de] transition-colors text-[#888]"
          ><IconChevronLeft size={16} /></button>
          <button onClick={() => navigate(1)}
            className="p-1.5 hover:bg-[#ece7de] transition-colors text-[#888]"
          ><IconChevronRight size={16} /></button>
        </div>
        <span className="flex-1 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">{headerLabel()}</span>
        <div className="flex items-center border border-[#ece7de] overflow-hidden">
          {(["month","week","day"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setCalView(v)}
              className={`text-xs px-3 py-1.5 capitalize transition-colors ${calView === v ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
            >{v}</button>
          ))}
        </div>
      </div>
      {calView === "month" && <MonthView anchor={anchor} showsByDate={showsByDate} venueMap={venueMap} />}
      {calView === "week" && <WeekView anchor={anchor} showsByDate={showsByDate} venueMap={venueMap} />}
      {calView === "day" && <DayView anchor={anchor} showsByDate={showsByDate} venueMap={venueMap} />}
    </div>
  );
}
