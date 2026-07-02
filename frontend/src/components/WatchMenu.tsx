import { useEffect, useRef } from "react";
import type { WatchStatus } from "../lib/api";

interface Props {
  showId: string;
  current?: WatchStatus;
  onSelect: (status: WatchStatus | null) => void;
  onClose: () => void;
}

const OPTIONS: { value: WatchStatus | null; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "tickets_bought", label: "Tickets bought" },
  { value: "waitlisting", label: "Waitlisting" },
  { value: "maybe", label: "Maybe" },
  { value: "passed", label: "Not going" },
  { value: null, label: "Remove" },
];

export default function WatchMenu({ current, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-100 rounded-xl shadow-sm py-1 w-44 dutch:bg-white dutch:border-[#ece7de]"
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={String(value)}
          onClick={() => onSelect(value)}
          className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-neutral-50 dutch:hover:bg-[#ece7de] ${
            current === value ? "text-neutral-900 font-medium dutch:text-[#1a1a1a]" : "text-neutral-500 dutch:text-[#888]"
          } ${value === null ? "text-neutral-300 border-t border-neutral-100 mt-1 pt-2 dutch:text-[#aaa] dutch:border-[#ece7de]" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
