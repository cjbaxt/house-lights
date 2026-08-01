import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: "not logged in" }), { status: 401 });

  const userId = locals.user.id;
  const { data, error } = await locals.supabase
    .from("friendship")
    .select("friend_id")
    .eq("user_id", userId);

  return new Response(JSON.stringify({ userId, rows: data, error }), {
    headers: { "Content-Type": "application/json" },
  });
};
