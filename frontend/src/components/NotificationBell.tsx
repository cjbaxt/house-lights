import { useState, useEffect, useRef } from "react";
import { IconBell, IconUserPlus } from "@tabler/icons-react";
import { createClient } from "../lib/supabase/client";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
function href(path: string) {
  return path === "/" ? `${BASE}/` : `${BASE}${path}`;
}

type Actor = { id: string; username: string; avatar_url: string | null };
type Notification = { id: string; type: string; read: boolean; created_at: string; actor: Actor };

export default function NotificationBell({ current }: { current: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(setNotifications)
      .catch(() => {});

    // Realtime: prepend new notifications as they arrive
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notification", filter: `user_id=eq.${user.id}` },
          (payload) => {
            // Fetch full notification with actor profile
            fetch("/api/notifications")
              .then((r) => r.json())
              .then(setNotifications)
              .catch(() => {});
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggleOpen() {
    if (!open && unread > 0) {
      // Mark all as read
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: "all" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    setOpen((v) => !v);
  }

  async function followBack(actorId: string) {
    setFollowingBack((prev) => new Set(prev).add(actorId));
    const form = new FormData();
    form.set("user_id", actorId);
    form.set("action", "follow");
    await fetch("/api/users/follow", { method: "POST", body: form });
  }

  function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="relative" ref={ref}>
      {/* Notification bell */}
      <div className="relative">
        <button
          onClick={toggleOpen}
          aria-label="Notifications"
          className={`relative flex items-center transition-colors ${
            open ? "text-[#f5f3ef]" : "text-[#f5f3ef]/40 hover:text-[#f5f3ef]"
          }`}
        >
          <IconBell size={18} strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#e85d2f] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-8 w-72 bg-[#1a1a1a] border border-[#333] shadow-xl z-50">
            <div className="px-4 py-3 border-b border-[#333]">
              <span className="text-xs font-bold uppercase tracking-widest text-[#f5f3ef]/40">Notifications</span>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#f5f3ef]/30 text-center">No notifications yet</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-[#262626] ${n.read ? "" : "bg-[#222]"}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {n.actor.avatar_url ? (
                        <img src={n.actor.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#333] flex items-center justify-center text-xs text-[#f5f3ef]/50">
                          {n.actor.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#f5f3ef] leading-relaxed">
                        <a href={href(`/u/${n.actor.username}`)} className="font-bold hover:text-[#e85d2f] transition-colors">
                          {n.actor.username}
                        </a>{" "}
                        started following you
                      </p>
                      <p className="text-[10px] text-[#f5f3ef]/30 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.type === "follow" && (
                      <button
                        onClick={() => followBack(n.actor.id)}
                        disabled={followingBack.has(n.actor.id)}
                        className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-[#f5f3ef]/20 text-[#f5f3ef]/50 hover:border-[#e85d2f] hover:text-[#e85d2f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <IconUserPlus size={11} strokeWidth={2} />
                        {followingBack.has(n.actor.id) ? "Following" : "Follow"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
