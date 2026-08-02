import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

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

  const admin = createServiceClient();

  const { data: codeRow, error: codeErr } = await admin
    .from("invite_code")
    .select("id, use_count, max_uses")
    .eq("code", inviteCode)
    .maybeSingle();

  if (codeErr || !codeRow) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("Invalid invite code.")}`);
  }
  if (codeRow.use_count >= codeRow.max_uses) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent("That invite code has no uses remaining.")}`);
  }

  const { data: signUpData, error } = await locals.supabase.auth.signUp({ email, password });

  if (error) {
    return redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  // Increment use count atomically — filter on use_count < max_uses to handle races
  if (signUpData?.user) {
    await admin.from("invite_code")
      .update({ use_count: codeRow.use_count + 1, used_at: new Date().toISOString(), used_by: signUpData.user.id })
      .eq("id", codeRow.id)
      .lt("use_count", codeRow.max_uses);
  }

  return redirect("/check-email");
};
