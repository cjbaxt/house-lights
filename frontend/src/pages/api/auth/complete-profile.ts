import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) return redirect("/login");

  const form = await request.formData();
  const username = (form.get("username") as string ?? "").trim().toLowerCase();
  const display_name = (form.get("display_name") as string ?? "").trim();

  if (!username || !/^[a-z0-9_-]+$/.test(username) || username.length < 2 || username.length > 30) {
    return redirect("/welcome?error=" + encodeURIComponent("Username must be 2–30 characters: letters, numbers, - and _ only"));
  }

  const { error } = await locals.supabase
    .from("profile")
    .update({
      username,
      display_name: display_name || null,
      username_confirmed: true,
    })
    .eq("id", locals.user.id);

  if (error) {
    const msg = error.code === "23505"
      ? "That username is already taken"
      : error.message;
    return redirect("/welcome?error=" + encodeURIComponent(msg));
  }

  return redirect("/");
};
