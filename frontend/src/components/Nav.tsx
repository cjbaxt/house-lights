import { useState, useEffect, useRef } from "react";
import { IconLayoutList, IconCalendarHeart, IconInfoCircle, IconUsers } from "@tabler/icons-react";
import { createClient } from "../lib/supabase/client";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const links = [
  { path: "/", label: "Browse", icon: IconLayoutList },
  { path: "/watchlist", label: "Watchlist", icon: IconCalendarHeart },
  { path: "/friends", label: "Friends", icon: IconUsers },
  { path: "/about", label: "About", icon: IconInfoCircle },
];

function href(path: string) {
  return path === "/" ? `${BASE}/` : `${BASE}${path}`;
}

export default function Nav({ current }: { current: string }) {
  const [showMobileTop, setShowMobileTop] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setShowMobileTop(y < 10 || y < lastScrollY.current);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex fixed top-0 inset-x-0 z-40 h-14 border-b border-transparent bg-[#1a1a1a] items-center px-8">
        <a href={href("/")} className="font-sans font-black text-[13px] tracking-[0.1em] uppercase text-[#f5f3ef] mr-10 hover:opacity-70 transition-opacity">
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
                    ? "text-[#e85d2f] border-b border-[#e85d2f]"
                    : "text-[#f5f3ef]/40 hover:text-[#f5f3ef]"
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>
        {isLoggedIn === true && (
          <a
            href={href("/settings")}
            className={`text-sm pb-0.5 transition-colors ${
              current === "/settings"
                ? "text-[#e85d2f] border-b border-[#e85d2f]"
                : "text-[#f5f3ef]/40 hover:text-[#f5f3ef]"
            }`}
          >
            Settings
          </a>
        )}
        {isLoggedIn === false && (
          <div className="flex items-center gap-3">
            <a href={href("/login")} className="text-xs pb-0.5 text-[#f5f3ef]/40 hover:text-[#f5f3ef] transition-colors">
              Log in
            </a>
            <a href={href("/login?mode=signup")} className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 border border-[#f5f3ef]/30 text-[#f5f3ef]/70 hover:border-[#f5f3ef] hover:text-[#f5f3ef] transition-colors">
              Sign up
            </a>
          </div>
        )}
      </header>

      {/* Mobile top bar — hides on scroll down */}
      <header
        className={`md:hidden fixed top-0 inset-x-0 z-40 h-12 bg-[#1a1a1a] flex items-center justify-between px-4 transition-transform duration-200 ${
          showMobileTop ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <a href={href("/")} className="font-sans font-black text-[13px] tracking-[0.1em] uppercase text-[#f5f3ef] hover:opacity-70 transition-opacity">
          house lights
        </a>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#1a1a1a] border-t border-transparent"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center h-16">
          {links.map(({ path, label, icon: Icon }) => {
            const active = current === path;
            return (
              <a
                key={path}
                href={href(path)}
                className={`flex-1 flex flex-col items-center gap-1 pt-2 transition-colors ${
                  active
                    ? "text-[#e85d2f]"
                    : "text-[#f5f3ef]/30"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[10px] uppercase tracking-wider">{label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
