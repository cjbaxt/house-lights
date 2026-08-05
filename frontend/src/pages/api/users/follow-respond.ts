import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const actorId = form.get("actor_id") as string;
  const action = form.get("action") as string; // "accept" | "reject"

  if (!actorId || !["accept", "reject"].includes(action)) {
    return new Response("Bad request", { status: 400 });
  }

  const svc = createServiceClient();

  if (action === "accept") {
    // Promote pending → accepted
    await svc
      .from("friendship")
      .update({ status: "accepted" })
      .eq("user_id", actorId)
      .eq("friend_id", locals.user.id)
      .eq("status", "pending");

    // Replace follow_request notification with a follow notification
    // so the actor's bell shows "X accepted your follow request" in future
    await svc
      .from("notification")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("actor_id", actorId)
      .eq("type", "follow_request");

    await svc.from("notification").insert({
      user_id: locals.user.id,
      actor_id: actorId,
      type: "follow",
      read: true,
      created_at: new Date().toISOString(),
    });
  } else {
    // Reject — delete the pending friendship and the notification
    await svc
      .from("friendship")
      .delete()
      .eq("user_id", actorId)
      .eq("friend_id", locals.user.id)
      .eq("status", "pending");

    await svc
      .from("notification")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("actor_id", actorId)
      .eq("type", "follow_request");
  }

  return new Response("OK");
};
