import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const targetId = form.get("user_id") as string;
  const action = form.get("action") as string; // "follow" | "unfollow"

  if (!targetId || !["follow", "unfollow"].includes(action)) {
    return new Response("Bad request", { status: 400 });
  }
  if (targetId === locals.user.id) {
    return new Response("Cannot follow yourself", { status: 400 });
  }

  // Use service client for notification writes — the update RLS policy
  // requires user_id = auth.uid(), but the actor writing the notification
  // is not the recipient, so it would silently fail with the session client.
  const svc = createServiceClient();

  if (action === "follow") {
    await locals.supabase.from("friendship").upsert({
      user_id: locals.user.id,
      friend_id: targetId,
    });
    await svc.from("notification").upsert(
      { user_id: targetId, actor_id: locals.user.id, type: "follow", read: false, created_at: new Date().toISOString() },
      { onConflict: "user_id,actor_id,type" }
    );
  } else {
    await locals.supabase
      .from("friendship")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("friend_id", targetId);
    await svc
      .from("notification")
      .delete()
      .eq("user_id", targetId)
      .eq("actor_id", locals.user.id)
      .eq("type", "follow");
  }

  return new Response("OK");
};
