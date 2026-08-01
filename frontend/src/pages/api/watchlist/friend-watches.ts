import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

  const showIds = url.searchParams.get("show_ids")?.split(",").filter(Boolean) ?? [];
  if (showIds.length === 0) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

  // Get friends of current user
  const { data: friendshipRows } = await locals.supabase
    .from("friendship")
    .select("friend_id")
    .eq("user_id", locals.user.id);

  const friendIds = (friendshipRows ?? []).map((f: any) => f.friend_id as string);
  if (friendIds.length === 0) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

  // Get friends' watchlist entries for these shows
  const { data: watches } = await locals.supabase
    .from("watchlist")
    .select("user_id, show_id, status")
    .in("user_id", friendIds)
    .in("show_id", showIds);

  if (!watches || watches.length === 0) return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });

  // Get profiles for friends who have watches
  const watcherIds = [...new Set((watches as any[]).map((w) => w.user_id))];
  const { data: profiles } = await locals.supabase
    .from("profile")
    .select("id, username, display_name, avatar_url")
    .in("id", watcherIds);

  // Get privacy preferences — respect share_ticket_status
  const { data: prefsRows } = await locals.supabase
    .from("user_preferences")
    .select("user_id, share_ticket_status")
    .in("user_id", watcherIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  const prefsMap = Object.fromEntries((prefsRows ?? []).map((p: any) => [p.user_id, p]));

  // Build response: { [show_id]: [{profile, status}] }
  const result: Record<string, { profile: any; status: string }[]> = {};
  for (const watch of watches as any[]) {
    const profile = profileMap[watch.user_id];
    if (!profile) continue;
    const prefs = prefsMap[watch.user_id];
    const visibleStatus =
      watch.status === "tickets_bought" && prefs?.share_ticket_status === false
        ? "interested"
        : watch.status;
    if (!result[watch.show_id]) result[watch.show_id] = [];
    result[watch.show_id].push({ profile, status: visibleStatus });
  }

  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
};
