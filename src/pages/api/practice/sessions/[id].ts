import type { APIRoute } from "astro";
import { json, requireUser } from "@/lib/http";
import { getResult } from "@/lib/services/session-store";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  const result = await getResult(auth.supabase, auth.userId, context.params.id ?? "");
  if (!result) return json({ error: "Session not found" }, 404);
  return json(result);
};
