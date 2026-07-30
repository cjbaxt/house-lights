import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

export const GET: APIRoute = async ({ params }) => {
  const { username } = params;
  const supabase = createServiceClient();

  // Resolve username → user_id via profile
  const { data: profile } = await supabase
    .from("profile")
    .select("id, display_name")
    .eq("username", username)
    .single();

  if (!profile) {
    return new Response("User not found", { status: 404 });
  }

  // Fetch their watchlist with show data
  const { data: entries } = await supabase
    .from("watchlist")
    .select("status, notes, show:show_id(id, title, date, time, url, ticket_status)")
    .eq("user_id", profile.id)
    .neq("status", "passed");

  if (!entries) {
    return new Response("Not found", { status: 404 });
  }

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

  for (const entry of entries) {
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
      const dateStr = show.date.replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
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
};

function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
