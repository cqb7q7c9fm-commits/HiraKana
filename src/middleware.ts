import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// /api/practice is intentionally not listed: its handlers answer 401 JSON (not a redirect), which the client relies on.
const PROTECTED_ROUTES = ["/dashboard", "/practice", "/results", "/hot-5", "/mastery"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  context.locals.supabase = supabase;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  const { pathname } = context.url;
  if (PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
