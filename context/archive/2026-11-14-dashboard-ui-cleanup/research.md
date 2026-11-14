---
date: 2026-11-14T21:29:30+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 9d6ff7c40f1920840e6ec8aa40a48f38cf0596fc
branch: main
repository: HiraKana
topic: "Audit of src/pages/dashboard.astro against the design-system contract (10x-ui)"
tags: [research, ui, dashboard, tokens, shadcn, tailwind]
status: complete
last_updated: 2026-11-14
last_updated_by: Claude (Sonnet 5.5)
---

# Research: dashboard.astro vs the design-system contract

**Date**: 2026-11-14T21:29:30+01:00
**Git Commit**: 9d6ff7c (main, working tree clean at session start)

## Research Question

Which charges (missing tokens, missing shared component, accidental architecture) apply to `src/pages/dashboard.astro`, in both directions (source → views, view → source), so `/10x-plan` can phase a cleanup (not a restyle)?

## Summary

The token layer is intact but unused by views, and the dashboard reads none of it. The shadcn `Button` exists and is used by React islands, but not by the dashboard. Five charges, below. Evidence was read locally (single view, no sub-agents needed); the scan covered only the files named in each claim.

Corrections to the pre-audit message: (a) `bg-cosmic` is used in **10 files**, not 11 (the 11th hit was its definition in `global.css:113`); (b) `Topbar.astro` is **not** rendered on the dashboard. Its only consumer is `Welcome.astro:2,18`; (c) the agent rules file is `CLAUDE.md`, and `AGENTS.md` is a symlink to it.

## Detailed Findings

### Source → views (where values and components live)

- `src/styles/global.css:6-65` holds `:root` / `.dark` values (stock shadcn neutral greys, no brand colour). `global.css:67-109` publishes them in `@theme inline` as `--color-*`, which is the correct split; `bg-primary` etc. resolve.
- Token-role classes (`bg|text|border-` + background/foreground/card/primary/muted/accent/secondary) appear in exactly two files under `src/`: `global.css` and `components/ui/button.tsx`. No view or non-ui component uses them (grep over `src/`).
- `components/ui/` contains `button.tsx` and `LibBadge.astro`. `Button` is imported by 5 files: `auth/SubmitButton.tsx`, and `practice/{SetupStep,SummaryStep,QuestionStep,SyncBanner}.tsx`. `dashboard.astro` imports only `Layout`.
- `SubmitButton.tsx:17` passes `bg-purple-600 … hover:bg-purple-500` through `className`, overriding the `default` variant (tailwind-merge). Even existing `Button` use bypasses tokens.
- The look is carried by `@utility bg-cosmic` (`global.css:113-115`, hex `#0a0e1a/#0f1529`), outside `:root`/`.dark`. It is applied by 10 files: `Welcome.astro:5`, `pages/{practice:7, dashboard:8, hot-5:20, mastery:26}.astro`, `pages/auth/{confirm-email:22, signin:9, signup:9}.astro`, `pages/results/{index:15, [id]:27}.astro`.

### View → source (dashboard.astro)

The hard-coded scan (command in the 10x-ui skill) hits lines 9, 10, 13, 14, 16, 19, 25, 31, 37, 44 (10 lines; 0 token-role classes; 0 `ui/` imports).

- Surface/card (`:9`): `border-white/10 bg-white/10 text-white` → should be `bg-card text-card-foreground border-border` (or a `Card`; not installed).
- Heading (`:10`): `from-blue-200 to-purple-200` gradient → no token; decision needed (keep gradient as a themed token pair, or plain `text-foreground`).
- Body/secondary text (`:13,16`): `text-blue-100/80`, `text-blue-100/50` → `text-muted-foreground`.
- Primary CTA (`:19`): `bg-purple-600 hover:bg-purple-500` → `Button` default variant (`bg-primary`).
- Secondary links (`:25,31,37`) and Sign out (`:44`): identical `border-white/20 bg-white/10 hover:bg-white/20` strings, repeated 4 times → `Button variant="outline"|"secondary"` (`asChild` for links).

### Interaction states

- The dashboard's own classes define `hover:` on 5 lines and no `focus-visible` anywhere (`grep focus` on the file: 0 hits). `Button` defines `focus-visible:ring-[3px] ring-ring/50` and `disabled:` (`button.tsx:8`), so adopting it fixes focus-visible for free; the global `outline-ring/50` (`global.css:119`) is the only focus styling today.
- Empty/loading/error: the view has no data fetching; these states are N/A except `user?.email` fallback (see charge 3).

### Entry point / architecture

- `/dashboard` is in `PROTECTED_ROUTES` (`middleware.ts:6`); unauthenticated requests get `redirect("/auth/signin")` (`middleware.ts:21-23`). So `user` is non-null when the page renders. The `?.` at `dashboard.astro:14` is defensive only. Direct-link/logged-out entry is handled correctly.
- Sign out posts to `/api/auth/signout`, which redirects to `/` (`signout.ts:10`). Works.
- The page text "This page is only for authenticated users." (`:16`) is developer scaffolding shown to users.
- Navigation: dashboard is a hub of 4 equal-weight buttons (Start practice, Results, Hot-5, Mastery) in one centred card (`:18-41`); four other views link back with their own copy of `text-purple-300 hover:text-purple-100` (`practice:9`, `hot-5:22`, `mastery:28`, `results/index:17`, grep for `href="/dashboard"`). `Topbar.astro` has the same literals but only renders on the landing.
- Agent rules: `CLAUDE.md` has no UI block; no rule encourages arbitrary values (grep for arbitrary/colour/token in `CLAUDE.md`: none). `context/foundation/lessons.md` has one entry (per-user rows), none about UI.

## Charges

| # | Category | Evidence (file:line) | User impact | Fix / phase |
|---|---|---|---|---|
| C1 | Missing tokens | `dashboard.astro:9,10,13,14,16,19,25,31,37,44` palette classes; `global.css:113-115` hex in `bg-cosmic` | Dashboard ignores `.dark`/theme changes; every colour change is a 10-file hand edit | Phase 2: view reads role tokens; decide `bg-cosmic` mapping (see Open Questions) |
| C2 | Missing shared component | `dashboard.astro:18-48`: 4 hand-built link/button strings + Sign out; `ui/button.tsx` unused here | No `focus-visible` ring (keyboard users can't see focus); no consistent disabled/hover | Phase 3: `Button asChild` (links), `variant="outline"` for secondary, default for CTA |
| C3 | Accidental architecture | `dashboard.astro:16` scaffold text; `:18-41` four equal-weight actions; `:14` redundant `?.` | Users see "only for authenticated users" copy; no primary action hierarchy beyond one colour | Phase 3: remove scaffold line, order actions by priority; keep `?.` removal optional |
| C4 | Accidental architecture (rule) | `CLAUDE.md` (= `AGENTS.md`) has no UI block; `SubmitButton.tsx:17` overrides `Button` with palette classes | Next view copies the same literals; the contract regresses | Phase 5: add UI rule + hard-coded scan check (see Plan notes) |
| C5 | Missing tokens (shared) | `bg-cosmic` in 10 files; `text-purple-300` back-links in 4 views | Fixing dashboard alone leaves a visibly different page when navigating | **Deferred** (other views out of scope for "one view per change"); record in change.md |

## Code References

- `src/pages/dashboard.astro:8-48` - whole view; scan hits listed above
- `src/styles/global.css:6-65,67-109,113-115` - values, `@theme inline` publish, `bg-cosmic` utility
- `src/components/ui/button.tsx:8-30` - variants, focus-visible, disabled
- `src/components/auth/SubmitButton.tsx:15-18` - Button overridden with palette classes
- `src/middleware.ts:6,18-24` - protected-route redirect
- `src/pages/api/auth/signout.ts:4-10` - signout redirect to `/`

## Architecture Insights

- Contract variant confirmed: "fresh starter, dead token file". The token file is correct (`@theme inline` is wired); views simply never read it. Phase 1 (environment/library) needs no `shadcn init`; `Button` is already there. `Card` is not installed (`npx shadcn@latest add card` if wanted; optional, a token-styled `div` also satisfies the contract).
- Token values are neutral greys, so mapping the view to tokens **without** changing values turns the dashboard white-on-black in light mode, visually different from every other view. The values phase must decide this explicitly.
- `<html>` has no `dark` class (`Layout.astro:16-33`), so `.dark` values never apply today; any dark look must come from `:root` values or a class added in the layout.

## Historical Context (from prior changes)

- Not applicable: `context/changes/` contains only `bootstrap-verification` (no UI work). `context/archive/` was checked only for a name collision with `dashboard-ui-cleanup`, not searched for UI decisions.

## Related Research

None for UI.

## Open Questions

1. **Look decision (blocks Phase 2):** (a) re-point `:root` tokens to the cosmic dark palette (`--background` ≈ `#0a0e1a`, `--primary` purple) so all views can later adopt them, or (b) keep neutral tokens and make the dashboard light. Option (a) changes global values, which affects `Button` users in 5 files (practice/auth) in the same change; the exact visual impact on those was not inspected.
2. Is a `Card` component wanted, or `bg-card` on a plain `div`?
3. Should `text-purple-300` back-links in the 4 other views be touched? Default: deferred (C5).
4. Screenshot tooling: no Playwright/`toHaveScreenshot` config was checked; assume kitchen-sink page + manual screenshots unless found in the plan phase.
