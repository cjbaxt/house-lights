import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const { data } = await locals.supabase
    .from("notification")
    .select("id, type, read, created_at, actor:actor_id(id, username, avatar_url)")
    .eq("user_id", locals.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return new Response(JSON.stringify(data ?? []), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const { ids } = await request.json();

  if (ids === "all") {
    await locals.supabase
      .from("notification")
      .update({ read: true })
      .eq("user_id", locals.user.id)
      .eq("read", false);
  } else if (Array.isArray(ids)) {
    await locals.supabase
      .from("notification")
      .update({ read: true })
      .in("id", ids)
      .eq("user_id", locals.user.id);
  }

  return new Response("OK");
};
