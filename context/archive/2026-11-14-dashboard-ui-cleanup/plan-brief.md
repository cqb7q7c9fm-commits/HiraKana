# Dashboard UI Cleanup — Plan Brief

> Full plan: `context/changes/dashboard-ui-cleanup/plan.md`
> Research: `context/changes/dashboard-ui-cleanup/research.md`

## What & Why

`/dashboard` is the first screen users see after sign-in, but it is built from hard-coded palette classes and hand-made buttons, so it ignores the project's design tokens and shows no keyboard focus. This change makes it read tokens and shadcn components, and leaves a rule plus a check so the next view does not copy the drift.

## Starting Point

`src/styles/global.css` already defines and publishes shadcn tokens (neutral greys), and `ui/button.tsx` exists, but no view uses the tokens. The dashboard has 10 hard-coded lines and no `ui/` imports; 10 files share a hex-based `bg-cosmic` background; `CLAUDE.md` has no UI rule.

## Desired End State

`/dashboard` is a `Card` with one primary "Start practice" button and outline buttons for the rest, no scaffold text, a visible focus ring on every control, and the same cosmic look as the other views. The hard-coded scan on it returns 0 and runs on commit. A dev-only kitchen-sink page and saved screenshots prove the states.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Contract variant | Extend the existing starter system, no `shadcn init` | Tokens and `Button` already exist; they just are not read | Research |
| Look | Cosmic values in `:root`, `.dark` mirrors it | Keeps the dashboard consistent with 9 dark views and lets later views adopt tokens | Plan |
| Card | Add shadcn `Card` | A real shared surface instead of another `div` copy | Plan |
| Visual gate | Dev-only `/dev/kitchen-sink` plus manual screenshots | No Playwright in repo; no new dependency | Plan |
| Check | Node script run by lint-staged on cleaned views | Repo already has husky + lint-staged; a failing check beats a forgotten rule | Plan |
| Other views | Deferred (`bg-cosmic` use, back-links) | One view per change | Research |
| Heading gradient | Dropped for plain `text-foreground` | No token for it; smallest correct fix | Plan |

## Scope

**In scope:** `dashboard.astro`, token values and `bg-cosmic` in `global.css`, `Card` install, removing the palette override in `SubmitButton.tsx`, kitchen sink, check script, `CLAUDE.md` UI block.

**Out of scope:** restyling other views, light theme or dark toggle, Playwright, CI changes, layout redesign.

## Architecture / Approach

Contract before pixels: add Card, then make `:root` carry the cosmic look and rebuild `bg-cosmic` from tokens, then rewrite the view from tokens and components, then prove states, then add the rule and check. The 10x-ui hard-coded scan is re-run after each visual phase and must only fall.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Library | `ui/card.tsx` via shadcn CLI | CLI may try to overwrite `button.tsx`/`global.css` |
| 2. Token values | Cosmic `:root`, `bg-cosmic` from tokens, `tokens.md`, `SubmitButton` cleanup | Changes `Button` look in 5 files; needs before/after screenshots |
| 3. View | Dashboard on `Card`/`Button`/tokens | Losing the gradient heading; action hierarchy is a judgement call |
| 4. States and gate | `/dev/kitchen-sink`, screenshots | Route must 404 in production |
| 5. Guard | Check script, lint-staged hook, `CLAUDE.md` UI block, impl-review | Cleaned-views list is manual |

**Prerequisites:** local Supabase for the signed-in dashboard screenshots and `npm run smoke`.
**Estimated effort:** ~2 sessions across 5 small phases.

## Open Risks & Assumptions

- Phase 2 touches global values, so auth and practice screens may shift slightly; accepted only with explained differences.
- Hover and focus-visible cannot be rendered statically; they are shown through interaction screenshots.
- Assumes `.claude/skills/10x-ui/references/ui-quality-checklist.md` exists for the final checklist.

## Success Criteria (Summary)

- A signed-in user sees a consistent dashboard with a clear primary action and visible keyboard focus.
- The hard-coded scan on `dashboard.astro` is 0 (from 10) and fails a commit if it regresses.
- The next agent finds the UI rule in `CLAUDE.md` and the components in `src/components/ui/`.
