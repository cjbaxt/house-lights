import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  if (!email || !password || password.length < 8) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const { error } = await locals.supabase.auth.signUp({ email, password });

  if (error) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  return redirect("/?welcome=1");
};
