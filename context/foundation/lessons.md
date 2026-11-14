# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Unbounded per-user resource creation without a cap or cleanup

- **Context**: src/pages/api/practice/sessions/index.ts:15 (F4, save-session-results) — a session is created on every practice start, abandoned ones stay incomplete forever.
- **Problem**: A user can create sessions without limit and abandoned sessions are never cleaned up (table bloat only; reads are capped at 20). The index session_answers_user_romaji_idx has no reader until S-03/S-06.
- **Rule**: Every endpoint that creates per-user rows states a cap or cleanup plan; add an index only with its first reader.
- **Applies to**: API routes and migrations that create per-user rows.
