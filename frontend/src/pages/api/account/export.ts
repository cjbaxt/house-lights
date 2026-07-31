import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const [profileRes, watchlistRes] = await Promise.all([
    locals.supabase
      .from("profile")
      .select("username, display_name, is_public, created_at")
      .eq("id", locals.user.id)
      .single(),
    locals.supabase
      .from("watchlist")
      .select("status, notes, added_at, show:show_id(title, date, time, type, url, venue:venue_id(name))")
      .eq("user_id", locals.user.id)
      .order("added_at", { ascending: false }),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: {
      email: locals.user.email,
      ...profileRes.data,
    },
    watchlist: (watchlistRes.data ?? []).map((e: any) => ({
      status: e.status,
      notes: e.notes ?? null,
      added_at: e.added_at,
      show: e.show,
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="house-lights-export.json"',
    },
  });
};
