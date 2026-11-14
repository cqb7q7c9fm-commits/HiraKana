<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Hot-5 — najtrudniejsze znaki

- **Plan**: context/changes/hot-five-difficult-chars/plan.md
- **Scope**: Full plan (2 of 2 phases)
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: hot-5 commits (dca7293, 3ec86ca, 3dd4f49) touch only the planned files (src/lib/hot-five.ts, src/pages/hot-5.astro, src/middleware.ts, src/pages/dashboard.astro) plus change artifacts. Lint and `astro check` re-run green; smoke passed earlier on the same code; build green. Ranking checked on a sample (ki 5/5, ka 1/1, tsu 4/5, o 2/4, u 1/2; ha 0/5 excluded; cross-multiplied tie-break by errors then romaji). Manual items 1.4-1.6 and 2.5-2.9 confirmed by the user. Other files in the git range belong to group-practice (S-04) and were not reviewed here.

## Findings

### F1 — Unknown romaji dropped after the limit is applied

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/hot-5.astro:13
- **Detail**: `rankHotFive` slices to 5 before the page drops stats whose romaji is not in `KANA`, so the list could be shorter than 5 although more candidates exist. Stats come from `session_answers`, which `saveAnswerSchema` restricts to `KANA` romaji, so it cannot happen with current data.
- **Fix**: Leave as is, or filter stats against `KANA` before calling `rankHotFive`.
- **Decision**: PENDING

### F2 — aria-label on list items replaces visible content

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/hot-5.astro:45
- **Detail**: Each `<li>` has an `aria-label` that duplicates the visible text and overrides it for screen readers (kana and rank are lost; `aria-label` on `listitem` is weakly supported). Other pages in the repo (`src/pages/results/index.astro`) rely on visible text only.
- **Fix**: Drop the `aria-label` on `<li>` and add a visually hidden "errors out of answers" text next to the `3/5` instead.
- **Decision**: PENDING
