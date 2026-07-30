import { createClient } from "@supabase/supabase-js";

// Service-role client — server-side only, bypasses RLS
export function createServiceClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
