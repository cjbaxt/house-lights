import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.auth.admin.deleteUser(locals.user.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response("OK");
};
