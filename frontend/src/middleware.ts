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

  const { data: { session } } = await context.locals.supabase.auth.getSession();
  context.locals.user = session?.user ?? null;

  // Redirect users who haven't set a username yet to the welcome/onboarding page
  if (context.locals.user) {
    const path = new URL(context.request.url).pathname;
    const isExempt = path.startsWith("/api/") || path === "/welcome" || path === "/login" || path === "/logout" || path === "/check-email" || path === "/privacy" || path === "/about" || path === "/feed";
    if (!isExempt) {
      const { data: profile } = await context.locals.supabase
        .from("profile")
        .select("username_confirmed")
        .eq("id", context.locals.user!.id)
        .single();
      if (profile && !profile.username_confirmed) {
        return context.redirect("/welcome");
      }
    }
  }

  const response = await next();

  // Security headers — skip on redirects (redirect responses have immutable headers)
  if (response.status >= 300 && response.status < 400) return response;

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  return response;
});
