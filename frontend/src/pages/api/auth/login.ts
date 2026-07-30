import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
  }

  return redirect("/");
};
