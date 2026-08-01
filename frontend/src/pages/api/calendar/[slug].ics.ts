import type { APIRoute } from "astro";
import { createHmac } from "crypto";
import { createServiceClient } from "../../../lib/supabase/service";

function icsDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(`${dateStr}${timeStr ? "T" + timeStr : "T00:00:00"}`);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + (timeStr ? "" : "Z");
}

function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug ?? "";
    const supabase = createServiceClient();

    // Private signed token: {uuid}-{64 hex chars}
    const tokenMatch = slug.match(/^([0-9a-f-]{36})-([0-9a-f]{64})$/);

    if (tokenMatch) {
      // Private calendar — verify HMAC signature
      const secret = import.meta.env.CALENDAR_SECRET ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) return new Response("Server misconfiguration", { status: 500 });

      const [, userId, sig] = tokenMatch;
      const expected = createHmac("sha256", secret).update(userId).digest("hex");
      if (sig !== expected) return new Response("Invalid token", { status: 401 });

      const today = new Date().toISOString().split("T")[0];
      const { data: entries } = await supabase
        .from("watchlist")
        .select("status, show:show_id(id, title, date, time, end_time, url, description, venue:venue_id(name))")
        .eq("user_id", userId)
        .gte("show.date", today)
        .neq("status", "passed");

      const shows = (entries ?? []).filter((e: any) => e.show);

      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//house lights//EN",
        "X-WR-CALNAME:house lights watchlist",
        "X-WR-CALDESC:Your house lights watchlist",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      for (const entry of shows) {
        const s = entry.show as any;
        const dtstart = icsDate(s.date, s.time);
        const dtend = s.end_time
          ? icsDate(s.date, s.end_time)
          : icsDate(s.date, s.time ? String(parseInt(s.time) + 2).padStart(2, "0") + s.time.slice(2) : null);
        const statusEmoji = entry.status === "tickets_bought" ? "🎫 " : "";
        lines.push(
          "BEGIN:VEVENT",
          `UID:${s.id}@houselights`,
          `DTSTART:${dtstart}`,
          `DTEND:${dtend}`,
          `SUMMARY:${icsEscape(statusEmoji + s.title)}`,
          ...(s.venue?.name ? [`LOCATION:${icsEscape(s.venue.name)}`] : []),
          ...(s.url ? [`URL:${s.url}`] : []),
          ...(s.description ? [`DESCRIPTION:${icsEscape(s.description.slice(0, 500))}`] : []),
          "END:VEVENT",
        );
      }

      lines.push("END:VCALENDAR");

      return new Response(lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'attachment; filename="house-lights.ics"',
          "Cache-Control": "no-cache",
        },
      });
    }

    // Public calendar by username
    const username = slug;
    const { data: profile } = await supabase
      .from("profile")
      .select("id, display_name")
      .eq("username", username)
      .single();

    if (!profile) return new Response("User not found", { status: 404 });

    const { data: entries } = await supabase
      .from("watchlist")
      .select("status, notes, show:show_id(id, title, date, time, url)")
      .eq("user_id", profile.id)
      .neq("status", "passed");

    const calName = `${profile.display_name ?? username}'s Watchlist`;
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//house-lights//EN",
      `X-WR-CALNAME:${calName}`,
      "X-WR-CALDESC:Amsterdam events watchlist from houselights.claireheaded.com",
      "REFRESH-INTERVAL;VALUE=DURATION:P1D",
      "X-PUBLISHED-TTL:P1D",
    ];

    for (const entry of (entries ?? [])) {
      const show = entry.show as any;
      if (!show) continue;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${show.id}@house-lights`);
      lines.push(`SUMMARY:${icsEscape(show.title)}`);
      if (show.time) {
        const [y, m, d] = show.date.split("-");
        const [h, min] = show.time.split(":");
        lines.push(`DTSTART:${y}${m}${d}T${h}${min}00Z`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${show.date.replace(/-/g, "")}`);
      }
      const descParts: string[] = [];
      if (entry.status) descParts.push(`Status: ${entry.status.replace(/_/g, " ")}`);
      if (show.url) descParts.push(show.url);
      if (entry.notes) descParts.push(entry.notes);
      if (descParts.length) lines.push(`DESCRIPTION:${icsEscape(descParts.join("\\n"))}`);
      if (show.url) lines.push(`URL:${show.url}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${username}-watchlist.ics"`,
      },
    });
  } catch (e) {
    console.error("ICS error:", e);
    return new Response(String(e), { status: 500 });
  }
};
