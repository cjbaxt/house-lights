import type { SupabaseClient } from "@supabase/supabase-js";

export async function getIsAdmin(supabase: SupabaseClient, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("profile")
    .select("is_admin")
    .eq("id", userId)
    .single();
  return data?.is_admin === true;
}
