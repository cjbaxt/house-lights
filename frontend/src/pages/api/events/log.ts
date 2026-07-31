import type { APIRoute } from "astro";

const ALLOWED_TYPES = new Set(["search", "watchlist_add", "watchlist_remove"]);

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { event_type, show_id, venue_id, city_id, metadata } =
    body as { event_type?: string; show_id?: string; venue_id?: string; city_id?: string; metadata?: Record<string, unknown> };

  if (!event_type || !ALLOWED_TYPES.has(event_type)) {
    return new Response("Invalid event_type", { status: 400 });
  }

  await locals.supabase.from("event_log").insert({
    event_type,
    user_id: locals.user?.id ?? null,
    show_id: show_id ?? null,
    venue_id: venue_id ?? null,
    city_id: city_id ?? null,
    metadata: metadata ?? null,
  });

  return new Response(null, { status: 204 });
};
