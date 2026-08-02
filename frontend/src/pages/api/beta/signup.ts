import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

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

  const admin = createServiceClient();

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
  const admin = createServiceClient();
  const { count } = await admin.from("profile").select("*", { count: "exact", head: true });
  const spotsLeft = Math.max(0, BETA_CAP - (count ?? 0));

  return new Response(JSON.stringify({ spotsLeft, cap: BETA_CAP }), {
    headers: { "Content-Type": "application/json" },
  });
};
