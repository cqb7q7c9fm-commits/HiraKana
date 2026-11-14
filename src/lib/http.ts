import type { APIContext } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

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
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json({ error: "Supabase is not configured" }, 500);
  return { supabase, userId: user.id };
}

/** Parses the JSON request body; returns undefined when it is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
