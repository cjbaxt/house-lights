// Editor mode = authenticated via Supabase. No passphrase needed.
import { createClient } from "./supabase/client";

export async function isEditor(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export function lock(): void {
  const supabase = createClient();
  supabase.auth.signOut().then(() => {
    window.location.href = "/login";
  });
}
