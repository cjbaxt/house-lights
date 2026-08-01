import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  try {
    const supabaseUrl = import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return new Response("Server misconfiguration", { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Remove avatar from storage before deleting user (storage doesn't cascade)
    const { data: files } = await admin.storage.from("avatars").list(locals.user.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${locals.user!.id}/${f.name}`);
      await admin.storage.from("avatars").remove(paths);
    }

    const { error } = await admin.auth.admin.deleteUser(locals.user.id);
    if (error) return new Response(error.message, { status: 500 });

    return new Response("OK");
  } catch (e) {
    console.error("delete account error:", e);
    return new Response(String(e), { status: 500 });
  }
};
