import { useState, useEffect, useRef } from "react";
import { createClient } from "../lib/supabase/client";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
function href(path: string) {
  return path === "/" ? `${BASE}/` : `${BASE}${path}`;
}

export default function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profile")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    });
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!profile) return null;

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex items-center"
      >
        <div className="w-7 h-7 rounded-full overflow-hidden bg-[#333] flex items-center justify-center ring-1 ring-[#444] hover:ring-[#f5f3ef] transition-all">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            : <span className="text-[10px] font-bold text-[#f5f3ef]/70">{initials}</span>
          }
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-44 bg-[#1a1a1a] border border-[#333] shadow-xl z-50 py-1">
          <a
            href={href(`/u/${profile.username}`)}
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2.5 text-xs text-[#f5f3ef]/70 hover:text-[#f5f3ef] hover:bg-[#252525] transition-colors"
          >
            Profile
          </a>
          <a
            href={href("/settings")}
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2.5 text-xs text-[#f5f3ef]/70 hover:text-[#f5f3ef] hover:bg-[#252525] transition-colors"
          >
            Settings
          </a>
          <div className="border-t border-[#333] my-1" />
          <a
            href={href("/api/auth/logout")}
            className="flex items-center px-4 py-2.5 text-xs text-[#f5f3ef]/40 hover:text-[#f5f3ef] hover:bg-[#252525] transition-colors"
          >
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
