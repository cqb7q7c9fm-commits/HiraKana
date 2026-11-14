import type { APIRoute } from "astro";
import { json, requireUser, withErrors } from "@/lib/http";
import { getCharStats } from "@/lib/services/session-store";

export const prerender = false;

export const GET: APIRoute = withErrors(async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  return json(await getCharStats(auth.supabase));
});
