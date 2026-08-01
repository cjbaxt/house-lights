import { defineMiddleware } from "astro:middleware";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => parseCookieHeader(context.request.headers.get("Cookie") ?? ""),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            context.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await context.locals.supabase.auth.getUser();
  context.locals.user = user ?? null;

  // Redirect users who haven't set a username yet to the welcome/onboarding page
  if (user) {
    const path = new URL(context.request.url).pathname;
    const isExempt = path.startsWith("/api/") || path === "/welcome" || path === "/login" || path === "/logout" || path === "/privacy" || path === "/about";
    if (!isExempt) {
      const { data: profile } = await context.locals.supabase
        .from("profile")
        .select("username_confirmed")
        .eq("id", user.id)
        .single();
      if (profile && !profile.username_confirmed) {
        return context.redirect("/welcome");
      }
    }
  }

  return next();
});
