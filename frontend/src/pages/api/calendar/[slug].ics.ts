import type { APIRoute } from "astro";
import { createHmac } from "crypto";
import { createServiceClient } from "../../../lib/supabase/service";

const TZ = "Europe/Amsterdam";

// Convert Amsterdam local date+time to UTC ICS stamp, handling DST correctly.
function localToUtcZ(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);
  const assumed = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  const localStr = assumed.toLocaleString("sv", { timeZone: TZ });
  const localDate = new Date(localStr.replace(" ", "T") + "Z");
  const offsetMs = localDate.getTime() - assumed.getTime();
  const utc = new Date(assumed.getTime() - offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

function localPlusHoursUtcZ(dateStr: string, timeStr: string, hours: number): string {
  const startMs = new Date(
    localToUtcZ(dateStr, timeStr).replace(
      /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
      "$1-$2-$3T$4:$5:$6Z"
    )
  ).getTime();
  const utc = new Date(startMs + hours * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

function nextDay(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildEvent(show: any, extra: { status?: string; notes?: string } = {}): string[] {
  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const hasTime = !!show.time;
  const timeStr = show.time?.slice(0, 5) ?? "20:00";

  let dtstart: string, dtend: string;
  if (hasTime) {
    dtstart = localToUtcZ(show.date, timeStr);
    if (show.end_time) {
      const endStr = show.end_time.slice(0, 5);
      const [sh, sm] = timeStr.split(":").map(Number);
      const [eh, em] = endStr.split(":").map(Number);
      const endDate = (eh * 60 + em < sh * 60 + sm) ? nextDay(show.date) : show.date;
      dtend = localToUtcZ(endDate, endStr);
    } else {
      dtend = localPlusHoursUtcZ(show.date, timeStr, 2);
    }
  } else {
    dtstart = show.date.replace(/-/g, "");
    dtend = nextDay(show.date).replace(/-/g, "");
  }

  const descParts: string[] = [];
  if (extra.status) descParts.push(`Status: ${extra.status.replace(/_/g, " ")}`);
  if (show.url) descParts.push(show.url);
  if (extra.notes) descParts.push(extra.notes);
  if (show.description) descParts.push(show.description.slice(0, 300));

  return [
    "BEGIN:VEVENT",
    `UID:${show.id}@houselights`,
    `DTSTAMP:${now}`,
    ...(hasTime ? [`DTSTART:${dtstart}`, `DTEND:${dtend}`]
                : [`DTSTART;VALUE=DATE:${dtstart}`, `DTEND;VALUE=DATE:${dtend}`]),
    `SUMMARY:${icsEscape(show.title)}`,
    ...(show.venue?.name ? [`LOCATION:${icsEscape(show.venue.name)}`] : []),
    ...(show.url ? [`URL:${show.url}`] : []),
    ...(descParts.length ? [`DESCRIPTION:${icsEscape(descParts.join("\\n"))}`] : []),
    "END:VEVENT",
  ];
}

const CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "text/calendar; charset=utf-8",
};

export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug ?? "";
    const supabase = createServiceClient();

    // Private signed token: {uuid}-{64 hex chars}
    const tokenMatch = slug.match(/^([0-9a-f-]{36})-([0-9a-f]{64})$/);

    if (tokenMatch) {
      const secret = import.meta.env.CALENDAR_SECRET ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) return new Response("Server misconfiguration", { status: 500 });

      const [, userId, sig] = tokenMatch;
      const expected = createHmac("sha256", secret).update(userId).digest("hex");
      if (sig !== expected) return new Response("Invalid token", { status: 401 });

      const today = new Date().toISOString().split("T")[0];
      const { data: entries } = await supabase
        .from("watchlist")
        .select("status, notes, show:show_id(id, title, date, time, end_time, url, description, venue:venue_id(name))")
        .eq("user_id", userId)
        .gte("show.date", today)
        .neq("status", "passed")
        .neq("status", "tickets_bought");

      const shows = (entries ?? []).filter((e: any) => e.show);
      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//house lights//EN",
        "X-WR-CALNAME:house lights watchlist",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      for (const entry of shows) {
        lines.push(...buildEvent(entry.show, { status: entry.status, notes: entry.notes }));
      }
      lines.push("END:VCALENDAR");

      return new Response(lines.join("\r\n"), {
        headers: {
          ...CACHE_HEADERS,
          "Content-Disposition": 'attachment; filename="house-lights.ics"',
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
      .select("status, notes, show:show_id(id, title, date, time, end_time, url, description, venue:venue_id(name))")
      .eq("user_id", profile.id)
      .neq("status", "passed")
      .neq("status", "tickets_bought");

    const calName = `${profile.display_name ?? username}'s Watchlist`;
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//house lights//EN",
      `X-WR-CALNAME:${calName}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const entry of (entries ?? [])) {
      const show = (entry as any).show;
      if (!show) continue;
      lines.push(...buildEvent(show, { status: (entry as any).status, notes: (entry as any).notes }));
    }
    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      headers: {
        ...CACHE_HEADERS,
        "Content-Disposition": `attachment; filename="${username}-watchlist.ics"`,
      },
    });
  } catch (e) {
    console.error("ICS error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
};
