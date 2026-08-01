import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const BETA_CAP = parseInt(import.meta.env.BETA_CAP ?? "10", 10);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const name = (form.get("name") as string)?.trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Valid email required." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // Count current registered users (profiles = confirmed users)
  const { count } = await admin.from("profile").select("*", { count: "exact", head: true });
  const spotsLeft = Math.max(0, BETA_CAP - (count ?? 0));

  if (spotsLeft > 0) {
    // Still space — direct them to register
    return new Response(JSON.stringify({ action: "register", spotsLeft }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cap reached — add to waitlist
  const { error } = await admin.from("beta_waitlist").upsert(
    { email, name, status: "waiting" },
    { onConflict: "email", ignoreDuplicates: true }
  );

  if (error) {
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ action: "waitlisted" }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async () => {
  const admin = createClient(
    import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const BETA_CAP_VAL = parseInt(import.meta.env.BETA_CAP ?? "10", 10);
  const { count } = await admin.from("profile").select("*", { count: "exact", head: true });
  const spotsLeft = Math.max(0, BETA_CAP_VAL - (count ?? 0));

  return new Response(JSON.stringify({ spotsLeft, cap: BETA_CAP_VAL }), {
    headers: { "Content-Type": "application/json" },
  });
};
