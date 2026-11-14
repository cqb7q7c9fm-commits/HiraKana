import type { APIContext, APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Resolves the Supabase client and signed-in user id for an API route, or the error response to return. */
export function requireUser(context: APIContext): { supabase: SupabaseClient; userId: string } | Response {
  const user = context.locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);
  const supabase = context.locals.supabase;
  if (!supabase) return json({ error: "Supabase is not configured" }, 500);
  return { supabase, userId: user.id };
}

/** Parses the JSON request body; returns undefined when it is not valid JSON or not sent as application/json. */
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.includes("application/json")) return undefined;
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Wraps a route handler so unexpected errors (e.g. database failures) are logged and become a JSON 500. */
export function withErrors(handler: APIRoute): APIRoute {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      // eslint-disable-next-line no-console -- the only trace of an unexpected server failure
      console.error(`${context.request.method} ${context.url.pathname} failed`, error);
      return json({ error: "Internal server error" }, 500);
    }
  };
}
