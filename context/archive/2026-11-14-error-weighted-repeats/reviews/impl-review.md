<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Error weighted repeats (S-03)

- **Plan**: context/changes/error-weighted-repeats/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run during review: `npm run lint`, `npx astro check` (0/0/0), `npm run check:session`, `npm run build`, `npm run smoke` — all PASS. Manual 3.6–3.10 confirmed by the user in the session.

## Findings

### F1 — Window query ranks all of a user's answers before keeping the last 5

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261114180000_recent_char_stats.sql:4-5,19-29
- **Detail**: `row_number() over (partition by romaji …)` runs over every answer of the user and only then filters `rn <= window_size`; Postgres cannot push the limit into the index. Cost per practice start grows linearly with lifetime answers (+10 rows per session), and the client gives up after 2.5 s (then silently falls back to uniform selection). The index also lacks `position`/`session_id`, which are in the window ORDER BY. Fits the lessons.md rule on unbounded per-user growth.
- **Fix**: Rewrite the function as `cross join lateral` over the distinct romaji of the user, each taking `order by answered_at desc, position desc, session_id desc limit window_size`, and extend the index to `(user_id, romaji, answered_at desc, position desc, session_id desc)`.
  - Strength: Per-character cost is bounded by the window, independent of history length.
  - Tradeoff: New migration (or edit of the unreleased one) and a slightly more complex query.
  - Confidence: MED — standard top-N-per-group pattern, not benchmarked on this schema.
  - Blind spot: No measurement of the current query at realistic volumes.
- **Decision**: FIXED — Fix now (migration 20261114190000_recent_char_stats_lateral.sql: lateral top-N + extended index)

### F2 — "Practice again" gives no feedback while stats load

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/practice/PracticeApp.tsx:22, src/components/practice/SummaryStep.tsx:85
- **Detail**: `starting` is only passed to `SetupStep`; on the summary screen the button stays active for up to ~2.5 s. Double clicks are still blocked by `startingRef`, so this is cosmetic. Plan only required the Start button.
- **Fix**: Pass `starting` to `SummaryStep` and disable "Practice again" while true.
- **Decision**: FIXED — Fix now (starting passed to SummaryStep, button disabled)

### F3 — getCharStats: unguarded null data and unused parameter

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/session-store.ts (getCharStats)
- **Detail**: `data as CharStatRow[]` is not null-guarded (null would throw and return 500); `_userId` is unused, unlike `listResults(supabase, userId, …)`.
- **Fix**: Use `data ?? []` and drop the unused `userId` parameter (and update the call in stats.ts).
- **Decision**: FIXED — Fix now (data ?? [], userId parameter dropped)

### F4 — useCharStats.ts is not a hook

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/useCharStats.ts
- **Detail**: Exports plain async `fetchCharStats`, but the `use*` filename in `components/hooks/` implies a hook.
- **Fix**: Rename to `charStats.ts` (or move to `src/lib/`) and update the import in usePracticeSession.ts.
- **Decision**: FIXED — Fix now (renamed to charStats.ts)

### F5 — Roadmap S-03 Decisions entry not committed

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/roadmap.md (S-03 block)
- **Detail**: Plan item 3.3 (Decisions entry, unknown removed) exists only in the working tree, mixed with uncommitted S-04 edits from group-practice; `/10x-archive` needs it committed.
- **Fix**: Commit roadmap.md (own S-03 hunks, with or together with S-04's) before archiving.
- **Decision**: FIXED — Fix now (roadmap.md committed whole, with S-04 changes)
