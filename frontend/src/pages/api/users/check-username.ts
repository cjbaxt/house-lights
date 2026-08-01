import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  const username = url.searchParams.get("username")?.trim().toLowerCase() ?? "";

  if (!username || !/^[a-z0-9_-]+$/.test(username) || username.length < 2 || username.length > 30) {
    return new Response(JSON.stringify({ available: false, error: "Invalid username" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data } = await locals.supabase
    .from("profile")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  // If the only match is the current user's own username, it's available
  const takenByOther = data && locals.user ? data.id !== locals.user.id : !!data;

  return new Response(JSON.stringify({ available: !takenByOther }), {
    headers: { "Content-Type": "application/json" },
  });
};
