import type { APIRoute } from "astro";

export const GET: APIRoute = () => new Response(null, { status: 405 });

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

  if (action === "follow") {
    await locals.supabase.from("friendship").upsert({
      user_id: locals.user.id,
      friend_id: targetId,
    });
    // Upsert notification — always reset to unread so re-follows surface again
    await locals.supabase.from("notification").upsert(
      { user_id: targetId, actor_id: locals.user.id, type: "follow", read: false, created_at: new Date().toISOString() },
      { onConflict: "user_id,actor_id,type" }
    );
  } else {
    await locals.supabase
      .from("friendship")
      .delete()
      .eq("user_id", locals.user.id)
      .eq("friend_id", targetId);
    // Remove the notification so a future re-follow triggers a fresh one
    await locals.supabase
      .from("notification")
      .delete()
      .eq("user_id", targetId)
      .eq("actor_id", locals.user.id)
      .eq("type", "follow");
  }

  return new Response("OK");
};
