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

  const svc = createServiceClient();

  if (action === "follow") {
    // Check if target has a private account
    const { data: targetProfile } = await svc
      .from("profile")
      .select("is_public")
      .eq("id", targetId)
      .single();

    const isPrivate = !targetProfile?.is_public;
    const status = isPrivate ? "pending" : "accepted";

    await locals.supabase.from("friendship").upsert({
      user_id: locals.user.id,
      friend_id: targetId,
      status,
    });

    if (isPrivate) {
      // Send a follow_request notification — recipient can accept/reject
      await svc.from("notification").upsert(
        { user_id: targetId, actor_id: locals.user.id, type: "follow_request", read: false, created_at: new Date().toISOString() },
        { onConflict: "user_id,actor_id,type" }
      );
    } else {
      // Public account — accepted immediately, send follow notification
      await svc.from("notification").upsert(
        { user_id: targetId, actor_id: locals.user.id, type: "follow", read: false, created_at: new Date().toISOString() },
        { onConflict: "user_id,actor_id,type" }
      );
    }

    return new Response(JSON.stringify({ status }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    await locals.supabase
      .from("friendship")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("friend_id", targetId);
    // Remove any follow or follow_request notification
    await svc
      .from("notification")
      .delete()
      .eq("user_id", targetId)
      .eq("actor_id", locals.user.id)
      .in("type", ["follow", "follow_request"]);

    return new Response(JSON.stringify({ status: "unfollowed" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
