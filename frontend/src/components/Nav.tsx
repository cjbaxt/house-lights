import { IconLayoutList, IconSparkles, IconBuildingStore, IconCalendarHeart, IconInfoCircle } from "@tabler/icons-react";
import ThemeToggle from "./ThemeToggle";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const links = [
  { path: "/", label: "Browse", icon: IconLayoutList },
  { path: "/discover", label: "Discover", icon: IconSparkles },
  { path: "/venues", label: "Venues", icon: IconBuildingStore },
  { path: "/watchlist", label: "Watchlist", icon: IconCalendarHeart },
  { path: "/about", label: "About", icon: IconInfoCircle },
];

function href(path: string) {
  return path === "/" ? `${BASE}/` : `${BASE}${path}`;
}

export default function Nav({ current }: { current: string }) {
  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex fixed top-0 inset-x-0 z-40 h-14 border-b border-neutral-100 bg-white/90 backdrop-blur-sm items-center px-8 glow:bg-[#0f0e16]/90 glow:border-[#1a1826]">
        <a href={href("/")} className="font-serif text-lg tracking-tight mr-10 hover:opacity-70 transition-opacity glow:glow-gradient-text">
          house lights
        </a>
        <nav className="flex gap-8 flex-1">
          {links.map(({ path, label }) => {
            const active = current === path;
            return (
              <a
                key={path}
                href={href(path)}
                className={`text-sm pb-0.5 transition-colors ${
                  active
                    ? "text-neutral-900 border-b border-neutral-900 glow:text-[#c084fc] glow:border-[#c084fc]"
                    : "text-neutral-400 hover:text-neutral-700 glow:text-[#4a4560] glow:hover:text-[#ede8f5]"
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <ThemeToggle />
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-neutral-100 bg-white/95 backdrop-blur-sm flex items-center glow:bg-[#0f0e16]/95 glow:border-[#1a1826]">
        {links.map(({ path, label, icon: Icon }) => {
          const active = current === path;
          return (
            <a
              key={path}
              href={href(path)}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 transition-colors ${
                active
                  ? "text-neutral-900 glow:text-[#c084fc]"
                  : "text-neutral-400 glow:text-[#4a4560]"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </a>
          );
        })}
        <div className="flex-1 flex flex-col items-center gap-1 pt-2">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
