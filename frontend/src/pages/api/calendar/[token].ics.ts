import type { APIRoute } from "astro";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

function icsDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(`${dateStr}${timeStr ? "T" + timeStr : "T00:00:00"}`);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + (timeStr ? "" : "Z");
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export const GET: APIRoute = async ({ params }) => {
  const { token } = params;
  const secret = import.meta.env.CALENDAR_SECRET ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  // Derive user_id by checking all users — instead, encode userId in token URL as userId.token
  // Token URL format: /api/calendar/{userId}-{token}.ics
  const match = (token ?? "").match(/^([0-9a-f-]{36})-([0-9a-f]{64})$/);
  if (!match) return new Response("Invalid token", { status: 400 });

  const [, userId, sig] = match;
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  if (sig !== expected) return new Response("Invalid token", { status: 401 });

  const supabase = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

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
    const dtend = s.end_time ? icsDate(s.date, s.end_time) : icsDate(s.date, s.time ? String(parseInt(s.time) + 2).padStart(2, "0") + s.time.slice(2) : null);
    const statusEmoji = entry.status === "tickets_bought" ? "🎫 " : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@houselights`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeIcs(statusEmoji + s.title)}`,
      ...(s.venue?.name ? [`LOCATION:${escapeIcs(s.venue.name)}`] : []),
      ...(s.url ? [`URL:${s.url}`] : []),
      ...(s.description ? [`DESCRIPTION:${escapeIcs(s.description.slice(0, 500))}`] : []),
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
};
