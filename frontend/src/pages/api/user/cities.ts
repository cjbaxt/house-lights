import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const cityId = form.get("city_id") as string;
  const enabled = form.get("enabled") === "true";

  if (enabled) {
    await locals.supabase
      .from("user_city")
      .upsert({ user_id: locals.user.id, city_id: cityId });
  } else {
    await locals.supabase
      .from("user_city")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("city_id", cityId);
  }

  return new Response("OK");
};
