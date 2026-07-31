import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // Remove avatar from storage before deleting user (storage doesn't cascade)
  const { data: files } = await admin.storage
    .from("avatars")
    .list(locals.user.id);
  if (files && files.length > 0) {
    const paths = files.map((f) => `${locals.user!.id}/${f.name}`);
    await admin.storage.from("avatars").remove(paths);
  }

  const { error } = await admin.auth.admin.deleteUser(locals.user.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response("OK");
};
