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
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-100 rounded-xl shadow-sm py-1 w-44 glow:bg-[#1a1826] glow:border-[#252336]"
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={String(value)}
          onClick={() => onSelect(value)}
          className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-neutral-50 glow:hover:bg-[#252336] ${
            current === value ? "text-neutral-900 font-medium glow:text-[#ede8f5]" : "text-neutral-500 glow:text-[#4a4560]"
          } ${value === null ? "text-neutral-300 border-t border-neutral-100 mt-1 pt-2 glow:text-[#3d3558] glow:border-[#252336]" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
