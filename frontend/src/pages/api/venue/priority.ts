import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";
import { getIsAdmin } from "../../../lib/admin";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!await getIsAdmin(locals.supabase, locals.user?.id)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const id = form.get("id") as string;
  const kind = form.get("kind") as string; // "venue" | "company"
  const priority = form.get("priority") as string;

  if (!id || !["venue", "company"].includes(kind) || !["high", "medium", "low"].includes(priority)) {
    return redirect("/settings?error=" + encodeURIComponent("Invalid request"));
  }

  const supabase = createServiceClient();
  const table = kind === "venue" ? "venue" : "company";
  const { error } = await supabase.from(table).update({ priority }).eq("id", id);

  if (error) return redirect("/settings?error=" + encodeURIComponent(error.message));
  return redirect("/settings?updated=1");
};
