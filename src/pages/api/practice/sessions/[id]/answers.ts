import type { APIRoute } from "astro";
import { json, readJson, requireUser, withErrors } from "@/lib/http";
import { saveAnswer, saveAnswerSchema } from "@/lib/services/session-store";

export const prerender = false;

export const POST: APIRoute = withErrors(async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  const parsed = saveAnswerSchema.safeParse(await readJson(context.request));
  if (!parsed.success) return json({ error: "Invalid request body" }, 400);

  const outcome = await saveAnswer(auth.supabase, auth.userId, context.params.id ?? "", parsed.data);
  if (outcome === "not-found") return json({ error: "Session not found" }, 404);
  if (outcome === "out-of-range") return json({ error: "Position out of range" }, 400);
  return json({ ok: true });
});
