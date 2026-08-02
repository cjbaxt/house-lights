import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  const inviteCode = (form.get("invite_code") as string | null)?.trim().toUpperCase();

  if (!email || !password || password.length < 8) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  if (!inviteCode) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("An invite code is required to sign up.")}`);
  }

  // Validate invite code using service role (bypasses RLS)
  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: codeRow, error: codeErr } = await admin
    .from("invite_code")
    .select("id, used_by")
    .eq("code", inviteCode)
    .maybeSingle();

  if (codeErr || !codeRow) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("Invalid invite code.")}`);
  }
  if (codeRow.used_by) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("That invite code has already been used.")}`);
  }

  const { data: signUpData, error } = await locals.supabase.auth.signUp({ email, password });

  if (error) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  // Mark code as used (best-effort — don't block signup if this fails)
  if (signUpData?.user) {
    await admin.from("invite_code").update({ used_by: signUpData.user.id, used_at: new Date().toISOString() }).eq("id", codeRow.id);
  }

  return redirect("/check-email");
};
