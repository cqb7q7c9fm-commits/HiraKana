import type { APIRoute } from "astro";
import { json, readJson, requireUser, withErrors } from "@/lib/http";
import { createSession, createSessionSchema, listResults } from "@/lib/services/session-store";

export const prerender = false;

export const POST: APIRoute = withErrors(async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  const parsed = createSessionSchema.safeParse(await readJson(context.request));
  if (!parsed.success) return json({ error: "Invalid request body" }, 400);

  const { alphabet, direction, total } = parsed.data;
  const id = await createSession(auth.supabase, auth.userId, alphabet, direction, total);
  if (id === null) return json({ error: "Too many open sessions" }, 429);
  return json({ id }, 201);
});

export const GET: APIRoute = withErrors(async (context) => {
  const auth = requireUser(context);
  if (auth instanceof Response) return auth;

  return json(await listResults(auth.supabase, auth.userId, 20));
});
