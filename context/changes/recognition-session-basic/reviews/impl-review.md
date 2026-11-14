<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sesja rozpoznawania znaków z informacją zwrotną

- **Plan**: context/changes/recognition-session-basic/plan.md
- **Scope**: Full plan (3 of 3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success Criteria (re-run on Node 26.13.0): `npm run check:session` PASS (46 rows, 4000 sessions), `npm run lint` PASS, `npx astro check` PASS (0/0/0), `npm run build` PASS, `npm run smoke` PASS (10/10, against dev server + local Supabase). Manual rows 1.4, 2.5–2.8, 3.4–3.6 were confirmed by the user.

Plan Adherence: no MISSING items, no violations of "What We're NOT Doing". Benign EXTRAs (all within phase intent, noted in commit messages): `AnswerRecord`/`PracticeStep` types, `startAgain()` in the hook, `ChoiceGroup` radiogroup helper, `lang="ja"` and sr-only labels, a too-few-entries guard in `buildSession`, extra checks in `check-session.mjs`.

## Findings

### F1 — Keyboard focus is lost after answering a question

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/practice/QuestionStep.tsx:49,86-95
- **Detail**: Answering sets `disabled` on all four option buttons, including the focused one, so focus falls to `<body>`. The Next button appears at the end of the DOM and is unmounted when clicked, losing focus again. Keyboard and screen-reader users must re-tab from the top after every question.
- **Fix**: Focus the Next button (ref + `useEffect` on `answered`) when it appears, and focus the prompt or first option when the question changes. Optionally use `aria-disabled` instead of `disabled`.
  - Strength: Fixes the main keyboard/screen-reader flow with a small local change.
  - Tradeoff: Adds a ref and effect to a currently stateless component.
  - Confidence: MED — standard behaviour of disabled controls; not tested in Safari/VoiceOver.
  - Blind spot: Real VoiceOver behaviour on iOS not verified.
- **Decision**: FIXED — Fix now (useFocusOnChange hook; focus on Next after answering, on prompt per question, on summary heading). Not committed.

### F2 — Step changes give no focus move or announcement

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/practice/PracticeApp.tsx:10-38, src/components/practice/SummaryStep.tsx
- **Detail**: Moving setup → question → summary swaps whole component trees. Screen-reader users get no cue about the new question or the final score; only the per-answer feedback text is in an `aria-live` region.
- **Fix**: Make each step's heading focusable (`tabIndex={-1}`) and focus it on step change, or add a polite live region announcing "Question N of 10" and the final score.
  - Strength: Small change that also helps F1 (one focus-management mechanism for both).
  - Tradeoff: Needs a shared pattern across the three steps.
  - Confidence: MED — common accessibility pattern; not verified with VoiceOver.
  - Blind spot: Interaction with the `aria-live` feedback region not tested.
- **Decision**: FIXED — Fix now (useFocusOnChange hook; focus on Next after answering, on prompt per question, on summary heading). Not committed.

### F3 — check:session is not run in CI and does not verify kana pairing

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/check-session.mjs, .github/workflows/ci.yml
- **Detail**: The script is only run locally (CI changes were out of scope). It asserts uniqueness of kana and romaji but not correct pairing, so a swapped pair (e.g. ち mapped to a wrong katakana) would pass. The data was verified by reading and by the user (1.4).
- **Fix**: Add `npm run check:session` to the `ci` job and assert `katakana.codePointAt(0) === hiragana.codePointAt(0) + 0x60` for each row.
- **Decision**: FIXED — Fix now (pairing assert in check-session.mjs, break-checked by swapping chi/tsu katakana; `npm run check:session` added to the ci job in .github/workflows/ci.yml). Not committed.

### F4 — lang="ja" wraps the romaji as well as the kana

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/practice/QuestionStep.tsx:79
- **Detail**: The pair `{kana} = {romaji}` is wrapped in one `lang="ja"` element, so screen readers pronounce the romaji with a Japanese voice.
- **Fix**: Put `lang="ja"` on the kana span only.
- **Decision**: FIXED — Fix now (lang="ja" only on the kana span in QuestionStep). Not committed.

### F5 — /practice has no way back to the dashboard or to sign out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/practice.astro
- **Detail**: `Topbar` is only rendered on the home page, so the "Practice" link is reachable from home/dashboard but `/practice` itself has only the browser back button. Topbar links are also small text links (pre-existing styling).
- **Fix**: Add a "Back to dashboard" link on `/practice` (or render a minimal header).
- **Decision**: FIXED — Fix now ("Back to dashboard" link in practice.astro). Not committed.

### F6 — min-h-screen uses 100vh on iOS Safari

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/practice.astro:6
- **Detail**: `min-h-screen` can be taller than the visible area while the iOS toolbar is shown, allowing slight scroll. Matches existing pages; 3.4/3.5 manual checks passed.
- **Fix**: Consider `min-h-dvh` here (and optionally on dashboard).
- **Decision**: FIXED — Fix now (min-h-dvh in practice.astro). Not committed.

### F7 — Middleware prefix match: verified not bypassable today

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:16
- **Detail**: The reviewer flagged possible bypass of `pathname.startsWith("/practice")` via encoded or double-slash paths. Tested on the dev server: `/practice`, `/practice/`, `/%70ractice`, `/practice%2F` all redirect to `/auth/signin` (same for `/dashboard`, `/%64ashboard`); `//practice` returns 200 but renders the home page (title "10x Astro Starter"), not the practice page. No bypass reproduced. Matching on a segment boundary (`p === r || p.startsWith(r + "/")`) would avoid over-matching such as `/practiceX`, but is not needed for correctness.
- **Fix**: Optional hardening only; revisit when S-02 stores per-user data.
- **Decision**: FIXED — Fix now (segment-boundary match in middleware.ts; re-checked /practice, /practice/, /%70ractice, /dashboard/x redirect, /practiceX is 404; smoke 10/10). Not committed.

### F8 — answer() has no explicit guard for an undefined question

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/usePracticeSession.ts:22-28
- **Detail**: `questions[index]` is typed as `Question` (no `noUncheckedIndexedAccess`), so `answer()` relies on the `step` guard to avoid an undefined question. Safe today.
- **Fix**: Add `if (!question) return;` in `answer()` to make the invariant explicit.
- **Decision**: FIXED — Fix now (explicit `if (!question) return;` in answer()). Not committed.
