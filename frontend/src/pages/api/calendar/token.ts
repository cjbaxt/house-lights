import type { APIRoute } from "astro";
import { createHmac } from "crypto";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const secret = import.meta.env.CALENDAR_SECRET ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const sig = createHmac("sha256", secret).update(locals.user.id).digest("hex");
  const token = `${locals.user.id}-${sig}`;

  return new Response(JSON.stringify({ token }), {
    headers: { "Content-Type": "application/json" },
  });
};
