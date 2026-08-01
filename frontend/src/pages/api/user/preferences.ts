import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("Bad request", { status: 400 });

  const allowed = ["hide_duplicate_shows", "share_ticket_status", "default_city_id"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) return new Response("Nothing to update", { status: 400 });

  const { error } = await locals.supabase
    .from("user_preferences")
    .update(update)
    .eq("user_id", locals.user.id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
};
