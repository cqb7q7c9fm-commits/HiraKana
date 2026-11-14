<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Zapis wyników sesji rozpoznawania

- **Plan**: context/changes/save-session-results/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run during review: `check:session`, `lint`, `astro check`, `build`, `smoke` — all PASS. Manual rows 1.4, 2.4, 3.5-3.8, 4.4-4.7 confirmed by the user.

## Findings

### F1 — Score and answers are writable directly through PostgREST

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261114120000_practice_sessions.sql:9-10, 44-47, 54-64; src/lib/services/session-store.ts:115, 142-157
- **Detail**: The comment says score is "never trusted from the client", but that holds only for our API routes. A signed-in user holding the anon key can PATCH `practice_sessions` (the update policy allows every column) with any `score`/`completed_at`, and INSERT `session_answers` with any `position` (no `>= 0` or `< total` check in the DB), which also lets junk rows satisfy the `answers.length >= total` check. Late answers after `completed_at` are accepted too, so `mistakes` (recomputed) can disagree with the frozen `score`. Low risk while results are private and single-user; real once rankings or streaks use the data (PRD non-goal today).
- **Fix A ⭐ Recommended**: Add DB guards in a new migration: `check (position >= 0)`, a trigger on `session_answers` that rejects `position >= total` and writes after `completed_at` is set, and correct the misleading comment.
  - Strength: Keeps the current API and client untouched; closes the junk-row and late-answer paths in one place.
  - Tradeoff: A trigger to maintain; a user can still PATCH their own `score` directly.
  - Confidence: HIGH — policy structure and constraints read directly in the migration.
  - Blind spot: Trigger behaviour with the upsert `ON CONFLICT DO NOTHING` path not yet exercised.
- **Fix B**: Revoke UPDATE on `practice_sessions` from `authenticated` and complete via a `security definer` RPC that computes `score` in SQL.
  - Strength: Score becomes truly server-computed.
  - Tradeoff: Rewrites `completeSession`, adds an RPC and more migration surface for a single-user app.
  - Confidence: MED — larger change than the threat model needs today.
  - Blind spot: RPC and RLS interplay not tested.
- **Decision**: FIXED via Fix A (migration 20261114160000_session_answers_guards.sql: position check, insert trigger, comment; saveAnswer no-op on completed session)

### F2 — A non-retryable 4xx leaves the client save queue stuck

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useAnswerSync.ts:41, 109-113, 156-161
- **Detail**: Any 4xx other than 401 marks the queue failed but keeps the head item (shifted only on success). A 400/404 on `/answers` then fails identically on every Retry, and a 409 from `/complete` has no recovery, so the summary never gets a stored result. Unlikely with a correct client, but the failure is unrecoverable without a reload.
- **Fix**: On 400/404 from `/answers`, drop the head item, mark `failed` and continue the queue; on 409 from `/complete`, re-drain once and retry.
- **Decision**: FIXED (400/404 on /answers now drops the head item and continues; a dropped answer ends as "Not saved". 409 on /complete is left to the existing Retry, which re-drains and re-calls complete)

### F3 — No error handling at the DB boundary in routes and pages

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice/sessions/**; src/lib/services/session-store.ts:62, 73, 96, 128, 158, 185; src/pages/results/index.astro:9; src/pages/results/[id].astro:10-14
- **Detail**: Service functions throw and nothing catches: API routes return Astro's bare 500 with no JSON body or logging, and the results pages render a bare 500. In the pages, a missing Supabase client or user is shown as an empty list / 404, which would mask a misconfiguration.
- **Fix**: Add one shared wrapper in `src/lib/http.ts` that catches, logs with `console.error` and returns `json({ error }, 500)`; in the pages return 500 when `supabase` is null.
- **Decision**: FIXED (withErrors wrapper in http.ts on all API handlers: logs and returns JSON 500; results pages return 500 when Supabase/user is missing)

### F4 — Unbounded session creation and an unused index

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice/sessions/index.ts:15; supabase/migrations/20261114120000_practice_sessions.sql:29-30
- **Detail**: A user can create sessions without limit and abandoned sessions are never cleaned up (bloat only; reads are capped at 20). `session_answers_user_romaji_idx` has no reader until S-03/S-06 and adds write cost; history has no pagination beyond the latest 20 (accepted in the plan).
- **Fix**: Leave as is for MVP scale ("ja albo garstka osób"); revisit with S-03.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Unbounded per-user resource creation without a cap or cleanup (cap of 30 incomplete sessions per user per hour -> 429; unused romaji index dropped in 20261114170000_drop_unused_romaji_index.sql)

### F5 — Duplicate answers are first-write-wins without signalling a mismatch

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/session-store.ts:117-129
- **Detail**: `ON CONFLICT DO NOTHING` returns 200 even if the stored row differs from the retry (different `romaji`/`is_correct`). Correct for idempotent retries; a stale queue would be silently ignored.
- **Fix**: Document the first-write-wins behaviour in the service comment.
- **Decision**: FIXED (first-write-wins documented in the saveAnswer comment)

### F6 — CSRF reliance and an undocumented API-route protection choice

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/http.ts:22-28; src/middleware.ts:4
- **Detail**: Protection is acceptable: cross-site `application/json` needs a CORS preflight the routes don't answer, `text/plain` is caught by Astro's origin check, and the body-less `/complete` relies on SameSite=Lax. `/api/practice` is intentionally absent from `PROTECTED_ROUTES` because `requireUser` returns 401 JSON that the client depends on, but this is not commented.
- **Fix**: Require `Content-Type: application/json` in `readJson` and add a one-line comment next to `PROTECTED_ROUTES`.
- **Decision**: FIXED (readJson requires application/json; comment on PROTECTED_ROUTES)

### F7 — Two Supabase clients and `getUser` calls per request

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/middleware.ts:7; src/lib/http.ts:16; src/pages/results/*.astro
- **Detail**: Middleware builds a client and calls `auth.getUser()` on every request; `requireUser` and the pages build another client. Extra round trips, not a bug. Existing auth routes also create their own client, so this follows the current pattern.
- **Fix**: Put the client on `context.locals` in the middleware — better handled as a separate refactor, not in this change.
- **Decision**: FIXED (client created once in middleware, exposed as Astro.locals.supabase; requireUser and results pages use it)

### F8 — Dead type `SavedAnswer` and a weaker smoke assertion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts:28; scripts/smoke.mjs:115-134
- **Detail**: `SavedAnswer` (renamed from the plan's `AnswerRecord` to avoid the S-01 collision) has no consumers. The smoke retry step checks status and `missing === 1` instead of counting rows directly (the later `score` check covers it indirectly).
- **Fix**: Remove `SavedAnswer` or use it in `useAnswerSync` instead of the local `QueuedAnswer`.
- **Decision**: FIXED (unused SavedAnswer type removed; smoke assertion left as is)
