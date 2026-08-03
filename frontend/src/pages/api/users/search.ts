import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });

  let query = locals.supabase
    .from("profile")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .eq("is_public", true)
    .limit(10);

  if (locals.user) query = query.neq("id", locals.user.id);

  const { data } = await query;

  return new Response(JSON.stringify(data ?? []), { headers: { "Content-Type": "application/json" } });
};
