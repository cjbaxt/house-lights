import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "clairejb93@gmail.com";

function adminClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function isAdmin(locals: App.Locals) {
  return locals.user?.email === ADMIN_EMAIL;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "HL-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const GET: APIRoute = async ({ locals }) => {
  if (!isAdmin(locals)) return new Response("Forbidden", { status: 403 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("invite_code")
    .select("id, code, note, created_at, used_at, used_by, profile:used_by(username)")
    .order("created_at", { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAdmin(locals)) return new Response("Forbidden", { status: 403 });

  const body = await request.json().catch(() => ({}));
  const note = (body.note as string | undefined)?.trim() || null;
  const count = Math.min(20, Math.max(1, parseInt(body.count ?? "1", 10)));

  const admin = adminClient();
  const codes = Array.from({ length: count }, () => ({ code: randomCode(), note }));
  const { data, error } = await admin.from("invite_code").insert(codes).select("id, code, note, created_at");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201, headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!isAdmin(locals)) return new Response("Forbidden", { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (!body.id) return new Response("Missing id", { status: 400 });

  const admin = adminClient();
  const { error } = await admin.from("invite_code").delete().eq("id", body.id).is("used_by", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
