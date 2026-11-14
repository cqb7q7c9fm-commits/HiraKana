import type { APIRoute } from "astro";
import { json, requireUser } from "@/lib/http";
import { completeSession } from "@/lib/services/session-store";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  const outcome = await completeSession(auth.supabase, auth.userId, context.params.id ?? "");
  if (!outcome) return json({ error: "Session not found" }, 404);
  if (outcome.status === "incomplete") {
    return json({ error: "Session has missing answers", missing: outcome.missing }, 409);
  }
  return json(outcome.result);
};
