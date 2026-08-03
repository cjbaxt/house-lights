import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";
import { getIsAdmin } from "../../../lib/admin";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "HL-" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const GET: APIRoute = async ({ locals }) => {
  if (!await getIsAdmin(locals.supabase, locals.user?.id)) return new Response("Forbidden", { status: 403 });

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("invite_code")
    .select("id, code, note, max_uses, use_count, created_at, used_at, users:profile(username)")
    .order("created_at", { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Reshape: attach the list of usernames who used each code
  const shaped = (data ?? []).map((c: any) => {
    const users = Array.isArray(c.users) ? c.users : (c.users ? [c.users] : []);
    return { ...c, users: users.map((u: any) => u.username) };
  });

  return new Response(JSON.stringify(shaped), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!await getIsAdmin(locals.supabase, locals.user?.id)) return new Response("Forbidden", { status: 403 });

  const body = await request.json().catch(() => ({}));
  const note = (body.note as string | undefined)?.trim() || null;
  const count = Math.min(20, Math.max(1, parseInt(body.count ?? "1", 10)));
  const maxUses = Math.min(100, Math.max(1, parseInt(body.max_uses ?? "1", 10)));

  const admin = createServiceClient();
  const codes = Array.from({ length: count }, () => ({ code: randomCode(), note, max_uses: maxUses }));
  const { data, error } = await admin.from("invite_code").insert(codes).select("id, code, note, created_at");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201, headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!await getIsAdmin(locals.supabase, locals.user?.id)) return new Response("Forbidden", { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (!body.id) return new Response("Missing id", { status: 400 });

  const admin = createServiceClient();
  const { error } = await admin.from("invite_code").delete().eq("id", body.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
