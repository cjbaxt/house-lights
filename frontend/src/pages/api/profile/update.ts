import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) return redirect("/login");

  const contentType = request.headers.get("content-type") ?? "";

  // JSON variant: partial profile update (e.g. is_public toggle)
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const allowed: Record<string, unknown> = {};
    if (typeof body.is_public === "boolean") allowed.is_public = body.is_public;

    if (Object.keys(allowed).length === 0) {
      return new Response("No valid fields", { status: 400 });
    }

    const { error } = await locals.supabase
      .from("profile")
      .update(allowed)
      .eq("id", locals.user.id);

    if (error) return new Response(error.message, { status: 500 });
    return new Response("OK");
  }

  const form = await request.formData();
  const username = (form.get("username") as string ?? "").trim().toLowerCase();
  const display_name = (form.get("display_name") as string ?? "").trim();

  if (!username || !/^[a-z0-9_-]+$/.test(username)) {
    return redirect("/settings?error=" + encodeURIComponent("Invalid username"));
  }

  const { error } = await locals.supabase
    .from("profile")
    .update({ username, display_name: display_name || null })
    .eq("id", locals.user.id);

  if (error) {
    const msg = error.code === "23505"
      ? "That username is already taken"
      : error.message;
    return redirect("/settings?error=" + encodeURIComponent(msg));
  }

  return redirect("/settings?updated=1");
};
