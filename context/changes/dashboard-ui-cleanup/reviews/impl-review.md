<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard UI Cleanup

- **Plan**: context/changes/dashboard-ui-cleanup/plan.md
- **Scope**: Full plan (phases 1-5; step 5.5 is this review)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: all 10 planned items MATCH (plan-drift reviewer); every Automated criterion re-run at review time (scans 0, lint, astro check, build); smoke and production 404 verified earlier in Phase 4/5. Step 5.5 itself was the only open row.

## Findings

### F1 — `dark:` variants in Button are inert; outline is an opaque navy slab, destructive has weak contrast

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/button.tsx:14-16 (used by src/pages/dashboard.astro:9, src/pages/dev/kitchen-sink.astro:14)
- **Detail**: `<html>` never gets `.dark` (Layout.astro:16), so every `dark:` variant in the shadcn Button never applies. The outline variant therefore renders `bg-background` + 10% white border instead of the glass look `dark:bg-input/30` was designed for (the dark slabs the user already saw and accepted in Phase 3). `variant="destructive"` would render white text on light red oklch(0.704), roughly 2.8:1; no Button uses it today, so it is latent.
- **Fix A ⭐ Recommended**: Keep as is; when the first destructive button is added, darken `--destructive` for the dark-only palette. Record in `tokens.md`.
  - Strength: Zero churn now; the outline look was explicitly accepted in Phase 3.
  - Tradeoff: The latent contrast issue stays until someone adds a destructive Button.
  - Confidence: HIGH — grep shows no `variant="destructive"` in `src/`.
  - Blind spot: Contrast ratio was estimated, not measured.
- **Fix B**: Add `class="dark"` to `<html>` in Layout so the `dark:` variants apply.
  - Strength: Button looks as designed by shadcn, including destructive.
  - Tradeoff: Global effect on every view and every `dark:` class; the other 9 views were not re-screenshotted for this.
  - Confidence: LOW — wide blast radius, only the dashboard was gated.
  - Blind spot: Other `dark:` usages in `src/`.
- **Decision**: FIXED via Fix A (limitation and the --destructive plan recorded in tokens.md; Button and Layout untouched)

### F2 — `check-hardcoded-ui.mjs`: false positive on `#anchors`, misses several utilities, raw stack trace on missing file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-hardcoded-ui.mjs:15-22,28
- **Detail**: Verified by running it: `href="#add"` fails the check (3 hex letters), while `accent-red-500` and `w-[10vh]` pass. Reviewer also found `caret-`, `decoration-`, `placeholder-`, `ring-offset-`, `inset-shadow-` and `%`/`calc()` arbitrary values unflagged, and a missing file throws an uncaught ENOENT trace. A hook that cries wolf on an anchor gets bypassed.
- **Fix**: Ignore `#` right after `href="`/`href='`; add `accent|caret|decoration|placeholder|ring-offset|inset-shadow` to the utility list; widen the arbitrary pattern to `-\[-?[0-9.]+(px|rem|em|vh|vw|%)\]`; wrap `readFileSync` in try/catch with a clear message.
- **Decision**: FIXED (anchors ignored, utilities and arbitrary units extended, unreadable file reported; re-tested: #add passes, 6 violations caught, missing file exits 1)

### F3 — SubmitButton hover is now darker instead of lighter

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/auth/SubmitButton.tsx:15
- **Detail**: Dropping the palette override moved hover from `purple-500` (lighter) to `bg-primary/90` (darker); corners went `rounded-lg` to `rounded-md` (accepted in Phase 2, 92 px diff). The reviewer's claim that `disabled:opacity-50` is new is wrong: it was in `button.tsx` before this change.
- **Fix**: Accept; no action.
- **Decision**: ACCEPTED (corner radius accepted in Phase 2; hover now primary/90; disabled fade is pre-existing)

### F4 — Heading structure: `h1` nested in `CardTitle` div; no headings in kitchen-sink cards; no `<main>`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/ui/card.tsx:27, src/pages/dashboard.astro:16-18
- **Detail**: `CardTitle` renders a `div` (stock shadcn), so the dashboard `h1` sits inside it; valid HTML, one `h1`. No page has a `<main>` landmark (pre-existing in Layout).
- **Fix**: Accept; add `<main>` in Layout in a separate change if wanted.
- **Decision**: ACCEPTED (valid HTML, one h1; <main> landmark is a Layout concern for a separate change)

### F5 — Kitchen-sink code ships in the production worker bundle

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dev/kitchen-sink.astro:9-11
- **Detail**: The guard is sound and was verified on a fresh production build (404, route present in bundle). Nothing sensitive is exposed; the page is only unreachable by guard, not absent.
- **Fix**: Accept; optionally move to an underscore-prefixed folder later.
- **Decision**: ACCEPTED (404 verified on a fresh production build; nothing sensitive in the bundle)

### F6 — Sidebar/chart tokens stay light-valued in `:root`; Banner unaffected

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/styles/global.css:33-62
- **Detail**: `--sidebar-*` and `--chart-*` keep the neutral light values under `:root` (unused today). `Banner.astro` uses its own scoped hex CSS, so it is unaffected (checked).
- **Fix**: Accept; when a sidebar is added, give it cosmic values.
- **Decision**: ACCEPTED (sidebar/chart tokens unused; Banner has its own scoped CSS)
