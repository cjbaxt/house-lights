import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  const showId = url.searchParams.get("show_id");
  if (!showId) return new Response("Missing show_id", { status: 400 });

  // Look up the show to get url + venue_id + city_id
  const { data: show } = await locals.supabase
    .from("show")
    .select("url, venue_id, city_id")
    .eq("id", showId)
    .single();

  if (!show?.url) return new Response("Not found", { status: 404 });

  // Log the click — fire-and-forget, don't block the redirect
  locals.supabase.from("event_log").insert({
    event_type: "ticket_click",
    user_id: locals.user?.id ?? null,
    show_id: showId,
    venue_id: show.venue_id ?? null,
    city_id: show.city_id ?? null,
  }).then(() => {}).catch(() => {});

  return Response.redirect(show.url, 302);
};
