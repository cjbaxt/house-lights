import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase/service";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  try {
    const admin = createServiceClient();

    // Remove avatar from storage before deleting user (storage doesn't cascade)
    const { data: files } = await admin.storage.from("avatars").list(locals.user.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${locals.user!.id}/${f.name}`);
      await admin.storage.from("avatars").remove(paths);
    }

    const { error } = await admin.auth.admin.deleteUser(locals.user.id);
    if (error) {
      console.error("delete account deleteUser error:", error);
      return new Response("Internal server error", { status: 500 });
    }

    return new Response("OK");
  } catch (e) {
    console.error("delete account error:", e);
    return new Response("Internal server error", { status: 500 });
  }
};
