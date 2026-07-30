import type { APIRoute } from "astro";
import { createClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const supabase = createClient(cookies);
  await supabase.auth.signOut();
  return redirect("/login");
};
