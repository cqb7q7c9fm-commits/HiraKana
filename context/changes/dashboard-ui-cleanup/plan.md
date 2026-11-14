# Dashboard UI Cleanup Implementation Plan

## Overview

Make `src/pages/dashboard.astro` read the design tokens that already exist in `src/styles/global.css` and use the shadcn `Button` and `Card` instead of hand-built `div`/`a`/`button` strings. Set the token values to the app's cosmic (dark purple) look so the dashboard stays consistent with the other views, then leave a rule and a pre-commit check so the next view does not regress. One view plus global tokens; no restyle of other views.

## Current State Analysis

- Contract variant: fresh starter with a dead token file. `global.css:6-109` defines `:root`/`.dark` values and publishes them via `@theme inline`; no view reads them (`research.md` § Source → views).
- `dashboard.astro` has 10 hard-coded lines (9, 10, 13, 14, 16, 19, 25, 31, 37, 44), 0 token classes, 0 `ui/` imports, and no `focus-visible` styling of its own.
- `bg-cosmic` (`global.css:113-115`) holds hex literals and is used by 10 files.
- `SubmitButton.tsx:17` overrides `Button` with `bg-purple-600 …`.
- Entry guard is correct: `middleware.ts:21-23` redirects unauthenticated `/dashboard` to `/auth/signin`.
- No Playwright, no screenshot tooling. `husky` + `lint-staged` are present (`.husky/pre-commit` runs `npx lint-staged`).
- `CLAUDE.md` (`AGENTS.md` is a symlink to it) has no UI rule and no rule encouraging arbitrary values.

## Desired End State

`/dashboard` renders from tokens and `ui/` components only: `Card` surface, `Button` actions (one primary, three outline, Sign out as outline), no scaffold text, visible keyboard focus ring on every control, visually consistent with the other cosmic views. `node scripts/check-hardcoded-ui.mjs src/pages/dashboard.astro` exits 0 (was 10 hits) and runs in lint-staged. `CLAUDE.md` tells the next agent where tokens and components live. A dev-only `/dev/kitchen-sink` page shows the state matrix.

### Key Discoveries:

- `Button` already provides `focus-visible:ring-[3px] ring-ring/50` and `disabled:` styles (`src/components/ui/button.tsx:8`); adopting it fixes focus and disabled with no new CSS.
- `<html>` has no `dark` class (`src/layouts/Layout.astro:16-33`), so `.dark` values never apply; the app is effectively dark-only, so cosmic values must live in `:root`.
- `SubmitButton.tsx:17` is the one existing `Button` consumer that bypasses tokens; it becomes redundant once `--primary` is purple.
- 5 files import `Button` (`auth/SubmitButton.tsx`, `practice/{SetupStep,SummaryStep,QuestionStep,SyncBanner}.tsx`), so Phase 2 changes their look and needs before/after screenshots.

## What We're NOT Doing

- No restyle or token adoption in the other 9 views; their `bg-cosmic` use and `text-purple-300` back-links stay (deferred C5, kept in `research.md` § Charges).
- No light theme and no dark-mode toggle; `.dark` simply mirrors `:root` so a future toggle does not switch palettes.
- No `shadcn init`, no second palette, no new npm dependency (Card is copied into the repo).
- No Playwright / `toHaveScreenshot`; no baseline files.
- No CI change (check runs in lint-staged and via an npm script).
- No layout redesign beyond removing scaffold text and giving "Start practice" the primary role.

## Implementation Approach

Fix the contract before the pixels: library (Card) → token values and `bg-cosmic` → the view → states and gate → rule and check. The scan from the 10x-ui skill is re-run after every visual phase and the count must only fall. Raw token values are written to `context/changes/dashboard-ui-cleanup/tokens.md` with a source line next to the edited block in `global.css`; the source is the repo's own existing literals (`#0a0e1a`, `#0f1529`, Tailwind purple-600/500), not an external theme.

## Phase 1: Library — add Card

### Overview

Add the shadcn `Card` component through the stack's path so the dashboard has a shared surface component.

### Changes Required:

#### 1. Card component

**File**: `src/components/ui/card.tsx`

**Intent**: Install the shadcn "new-york" `Card` family into the repo so the dashboard surface is a real shared component that reads `bg-card`/`border`.

**Contract**: Run `npx shadcn@latest add card`; exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. No `package.json` changes expected (it depends on `cn()` only). If the CLI proposes overwriting `button.tsx` or `global.css`, decline.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx` exists and `git diff --stat package.json package-lock.json` is empty
- Hard-coded scan on `src/components/ui/card.tsx` returns 0 lines
- Linting and type checks pass: `npm run lint` and `npx astro check`

#### Manual Verification:

(none — covered by Phase 3 visual checks)

**Implementation Note**: After automated verification passes, pause for confirmation before Phase 2.

---

## Phase 2: Token values — cosmic `:root`, `bg-cosmic` from tokens

### Overview

Make the existing tokens carry the app's real look, so every view reading them later is consistent, and remove the last hex literals from the token layer.

### Changes Required:

#### 1. Token values

**File**: `src/styles/global.css`

**Intent**: Set `:root` role tokens (`--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--input`, `--ring`) to the cosmic dark palette; `--background` ≈ the current `#0a0e1a`, `--card` a translucent/raised surface near `#0f1529`, `--primary` ≈ Tailwind purple-600 with `--ring` in the same hue. `.dark` mirrors `:root`. Add a one-line `Source:` comment next to the edited block naming where the values come from.

**Contract**: Names and `@theme inline` mapping are unchanged (no new role names beyond the existing shadcn set). Values are expressed in `oklch(...)` like the rest of the file. `--destructive` stays.

#### 2. `bg-cosmic` from tokens

**File**: `src/styles/global.css` (`@utility bg-cosmic`)

**Intent**: Rebuild the gradient from tokens (e.g. `var(--background)` to `var(--card)` and back) so it contains no hex literals and follows the token layer.

**Contract**: The utility name and use sites (10 files) stay the same; only its body changes. Visual result must stay within eyeball tolerance of the current gradient (verified by screenshots).

#### 3. Raw values record

**File**: `context/changes/dashboard-ui-cleanup/tokens.md`

**Intent**: Persist the final raw values (before/after) and their source so the next session does not re-invent them.

**Contract**: Table of token → old value → new value, plus the source sentence.

#### 4. Remove the Button override

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Drop `bg-purple-600 … hover:bg-purple-500 text-white` from the `className` so it takes the `default` variant, which is now purple through `--primary`. Keep layout classes (`w-full`).

**Contract**: Props and markup unchanged; only palette classes removed.

### Success Criteria:

#### Automated Verification:

- `context/changes/dashboard-ui-cleanup/tokens.md` exists and `global.css` contains a `Source:` comment next to the token block
- `@utility bg-cosmic` body contains no hex literal (grep of its lines for `#[0-9a-fA-F]{3,8}` returns 0)
- Hard-coded scan on `src/components/auth/SubmitButton.tsx` returns 0 lines
- Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build`

#### Manual Verification:

- Desktop and 390 px screenshots (before/after) of `/auth/signin`, `/auth/signup` and `/practice` show the same look to within the explained difference; no baseline or "after" is accepted without explaining the visual delta
- The cosmic gradient background on `/`, `/mastery` and `/results` looks unchanged to the eye

**Implementation Note**: Pause for manual confirmation of the screenshots before Phase 3.

---

## Phase 3: View — dashboard from tokens and components

### Overview

Rebuild `dashboard.astro` with `Card`, `Button` and tokens; remove scaffold text; give actions a hierarchy.

### Changes Required:

#### 1. Dashboard view

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the `div` surface with `Card`, the four links with `Button asChild` (primary for "Start practice", `variant="outline"` for Results, Hot-5, Mastery) and Sign out with an outline `Button` inside the existing `POST /api/auth/signout` form. Text uses `text-foreground` and `text-muted-foreground`; the heading becomes plain `text-foreground` (the blue-purple gradient is dropped). Remove "This page is only for authenticated users." and the redundant `?.` on `user.email` is optional (guard is in middleware).

**Contract**: Route, links (`/practice`, `/results`, `/hot-5`, `/mastery`), form action and method are unchanged. `Astro.locals.user` use is unchanged. No class in the file contains a palette name, an arbitrary value or a hex/rgb literal.

### Success Criteria:

#### Automated Verification:

- Hard-coded scan on `src/pages/dashboard.astro` returns 0 lines (was 10)
- `dashboard.astro` imports `@/components/ui/button` and `@/components/ui/card`, and the text "only for authenticated users" is absent
- Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build`

#### Manual Verification:

- Signed in, `/dashboard` at desktop and 390 px: "Start practice" reads as the primary action; each of the four links and Sign out works (Sign out lands on `/`)
- Keyboard Tab through all controls shows a visible ring on each, and tab order matches visual order
- Signed out, `/dashboard` redirects to `/auth/signin`

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: States and visual gate — kitchen sink

### Overview

Prove the 7-state matrix with a kitchen-sink page and save screenshots as the review evidence.

### Changes Required:

#### 1. Kitchen-sink page

**File**: `src/pages/dev/kitchen-sink.astro`

**Intent**: Dev-only page that renders `Card` and every `Button` variant used by the dashboard in default and disabled states, with a small table marking each of the 7 states as shown, interaction-verified, or N/A with reason (empty, loading, error are N/A for the dashboard: it fetches nothing and has no form that can fail).

**Contract**: `export const prerender = false`; returns a 404 response when `import.meta.env.PROD` is true so it never serves in production. Not protected by `PROTECTED_ROUTES` and not linked from any page. Uses tokens/components only.

#### 2. Screenshots

**File**: `context/changes/dashboard-ui-cleanup/screens/` (new)

**Intent**: Store desktop and 390 px screenshots of `/dashboard` and the kitchen sink, including hover and keyboard-focus shots, as the gate evidence.

**Contract**: PNG files named `<view>-<state>-<desktop|mobile>.png`.

### Success Criteria:

#### Automated Verification:

- `src/pages/dev/kitchen-sink.astro` exists, exports `prerender = false`, and against `npm run preview` `curl -s -o /dev/null -w '%{http_code}' $BASE_URL/dev/kitchen-sink` prints `404`
- Hard-coded scan on `src/pages/dev/kitchen-sink.astro` and `src/pages/dashboard.astro` returns 0 lines
- Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build`

#### Manual Verification:

- In `npm run dev`, `/dev/kitchen-sink` shows default and disabled; hover and focus-visible are demonstrated by interaction screenshots; each N/A cell states its reason
- Muted text on the card and primary button text are readable (minimum contrast check by eye on the screenshots)
- Desktop and 390 px screenshots are saved in `context/changes/dashboard-ui-cleanup/screens/`

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Guard — rule and check

### Overview

Leave the next agent a rule and a failing check so the contract holds.

### Changes Required:

#### 1. Hard-coded values check

**File**: `scripts/check-hardcoded-ui.mjs`

**Intent**: Dependency-free Node script that applies the 10x-ui scan regex to the files passed as arguments (default list: the views this change cleaned, currently `src/pages/dashboard.astro`) and exits 1 with `file:line` output on any hit.

**Contract**: `node scripts/check-hardcoded-ui.mjs [files…]`; exit 0 clean, exit 1 on hits. The cleaned-views list is a constant at the top of the file, to be extended when another view is cleaned.

#### 2. Hook and npm script

**File**: `package.json`

**Intent**: Run the script on `src/pages/dashboard.astro` through `lint-staged`, and add `check:ui` that runs it with the default list.

**Contract**: New `lint-staged` key for the cleaned view file(s) and `"check:ui": "node scripts/check-hardcoded-ui.mjs"`; no new dependency.

#### 3. Agent rule

**File**: `CLAUDE.md`

**Intent**: Add a short `### UI` block under "Key conventions": tokens live in `src/styles/global.css` (`:root` + `@theme inline`); components in `src/components/ui/` (check there first; add missing ones with `npx shadcn@latest add <name>`); no literal colours, palette classes or arbitrary values in views, use role tokens (`bg-card`, `text-muted-foreground`, `bg-primary`); `/dev/kitchen-sink` is the visual gate; `npm run check:ui` lists cleaned views.

**Contract**: Written outside any `<!-- BEGIN @przeprogramowani/10x-cli -->` block (none exists today); no rule encourages arbitrary values.

### Success Criteria:

#### Automated Verification:

- `node scripts/check-hardcoded-ui.mjs src/pages/dashboard.astro` exits 0, and exits 1 on a throwaway file containing `bg-purple-600`
- `package.json` contains the `lint-staged` entry for the script and the `check:ui` script
- `CLAUDE.md` has the `### UI` block and passes `npx prettier --check CLAUDE.md`
- Build and smoke pass: `npm run build` and `npm run smoke` (needs `npx supabase start` and `npm run preview`; same as the CI `smoke` job)

#### Manual Verification:

- `/10x-impl-review dashboard-ui-cleanup` was run and every UI finding is fixed or recorded as deferred with a reason
- The merge checklist `.claude/skills/10x-ui/references/ui-quality-checklist.md` was walked, and CI is not treated as the gate

---

## Testing Strategy

### Unit Tests:

- None (no test runner in the repo); the scan script is verified by one passing and one deliberately failing input.

### Integration Tests:

- `npm run smoke` for the auth flow after the token change.

### Manual Testing Steps:

1. Before Phase 2: screenshot `/auth/signin`, `/practice`, `/` as the "before" set.
2. After each visual phase: re-run the scan and compare screenshots at desktop and 390 px.
3. Tab through `/dashboard` and confirm the focus ring on each control.

## Performance Considerations

None: no new runtime dependency or network call; the kitchen-sink route returns 404 in production.

## Migration Notes

Phase 2 changes global token values. Rollback is reverting `global.css` and `SubmitButton.tsx`; no data is affected.

## References

- Related research: `context/changes/dashboard-ui-cleanup/research.md`
- Token source: `src/styles/global.css:6-115`
- Button variants: `src/components/ui/button.tsx:8-30`
- Entry guard: `src/middleware.ts:6,18-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Library — add Card

#### Automated

- [x] 1.1 `src/components/ui/card.tsx` exists and `git diff --stat package.json package-lock.json` is empty — 1713c98
- [x] 1.2 Hard-coded scan on `src/components/ui/card.tsx` returns 0 lines — 1713c98
- [x] 1.3 Linting and type checks pass: `npm run lint` and `npx astro check` — 1713c98

### Phase 2: Token values — cosmic `:root`, `bg-cosmic` from tokens

#### Automated

- [x] 2.1 `context/changes/dashboard-ui-cleanup/tokens.md` exists and `global.css` contains a `Source:` comment next to the token block — 7ebc262
- [x] 2.2 `@utility bg-cosmic` body contains no hex literal (grep of its lines for `#[0-9a-fA-F]{3,8}` returns 0) — 7ebc262
- [x] 2.3 Hard-coded scan on `src/components/auth/SubmitButton.tsx` returns 0 lines — 7ebc262
- [x] 2.4 Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build` — 7ebc262

#### Manual

- [x] 2.5 Desktop and 390 px screenshots (before/after) of `/auth/signin`, `/auth/signup` and `/practice` show the same look to within the explained difference — 7ebc262
- [x] 2.6 The cosmic gradient background on `/`, `/mastery` and `/results` looks unchanged to the eye — 7ebc262

### Phase 3: View — dashboard from tokens and components

#### Automated

- [x] 3.1 Hard-coded scan on `src/pages/dashboard.astro` returns 0 lines (was 10) — 7266d26
- [x] 3.2 `dashboard.astro` imports `@/components/ui/button` and `@/components/ui/card`, and the text "only for authenticated users" is absent — 7266d26
- [x] 3.3 Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build` — 7266d26

#### Manual

- [x] 3.4 Signed in, `/dashboard` at desktop and 390 px: "Start practice" reads as the primary action; each of the four links and Sign out works (Sign out lands on `/`) — 7266d26
- [x] 3.5 Keyboard Tab through all controls shows a visible ring on each, and tab order matches visual order — 7266d26
- [x] 3.6 Signed out, `/dashboard` redirects to `/auth/signin` — 7266d26

### Phase 4: States and visual gate — kitchen sink

#### Automated

- [x] 4.1 `src/pages/dev/kitchen-sink.astro` exists, exports `prerender = false`, and against `npm run preview` `curl -s -o /dev/null -w '%{http_code}' $BASE_URL/dev/kitchen-sink` prints `404`
- [x] 4.2 Hard-coded scan on `src/pages/dev/kitchen-sink.astro` and `src/pages/dashboard.astro` returns 0 lines
- [x] 4.3 Linting, types and build pass: `npm run lint`, `npx astro check`, `npm run build`

#### Manual

- [x] 4.4 In `npm run dev`, `/dev/kitchen-sink` shows default and disabled; hover and focus-visible are demonstrated by interaction screenshots; each N/A cell states its reason
- [x] 4.5 Muted text on the card and primary button text are readable (minimum contrast check by eye on the screenshots)
- [x] 4.6 Desktop and 390 px screenshots are saved in `context/changes/dashboard-ui-cleanup/screens/`

### Phase 5: Guard — rule and check

#### Automated

- [ ] 5.1 `node scripts/check-hardcoded-ui.mjs src/pages/dashboard.astro` exits 0, and exits 1 on a throwaway file containing `bg-purple-600`
- [ ] 5.2 `package.json` contains the `lint-staged` entry for the script and the `check:ui` script
- [ ] 5.3 `CLAUDE.md` has the `### UI` block and passes `npx prettier --check CLAUDE.md`
- [ ] 5.4 Build and smoke pass: `npm run build` and `npm run smoke` (needs `npx supabase start` and `npm run preview`)

#### Manual

- [ ] 5.5 `/10x-impl-review dashboard-ui-cleanup` was run and every UI finding is fixed or recorded as deferred with a reason
- [ ] 5.6 The merge checklist `.claude/skills/10x-ui/references/ui-quality-checklist.md` was walked, and CI is not treated as the gate
