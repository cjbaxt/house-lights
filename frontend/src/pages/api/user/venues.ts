import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const venueId = form.get("venue_id") as string;
  const hidden = form.get("hidden") === "true";

  if (hidden) {
    await locals.supabase.from("user_venue").upsert(
      { user_id: locals.user.id, venue_id: venueId, hidden: true },
      { onConflict: "user_id,venue_id" }
    );
  } else {
    await locals.supabase
      .from("user_venue")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("venue_id", venueId);
  }

  return new Response("OK");
};
