# Token values — dashboard-ui-cleanup (Phase 2)

Source: existing repo literals, not an external theme. `#0a0e1a` / `#0f1529` come from the old `@utility bg-cosmic`
(`src/styles/global.css`, before this change); purple comes from Tailwind purple-600 (primary) and purple-400 (ring),
already used as `bg-purple-600` / `focus:ring-purple-400` across the views. Hex → oklch computed with a throwaway script.

The app is dark-only (`<html>` never gets `dark`), so cosmic values live in `:root` and `.dark` mirrors them.

| Token | Before (`:root`, neutral shadcn) | After (`:root, .dark`) | Role / origin |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.166 0.026 269.4)` | `#0a0e1a`, page and gradient ends |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | primary text (was `text-white`) |
| `--card` | `oklch(1 0 0)` | `oklch(1 0 0 / 10%)` | dashboard surface (was `bg-white/10`) |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | |
| `--popover` | `oklch(1 0 0)` | `oklch(0.201 0.041 269.8)` | `#0f1529`, also gradient midpoint of `bg-cosmic` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.558 0.288 302.321)` | Tailwind purple-600 (was `bg-purple-600`) |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | unchanged |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(1 0 0 / 10%)` | translucent control surface (was `bg-white/10`) |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | |
| `--muted` | `oklch(0.97 0 0)` | `oklch(1 0 0 / 10%)` | |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.932 0.032 255.585 / 70%)` | Tailwind blue-100 at 70% (was `text-blue-100/80`, `/50`) |
| `--accent` | `oklch(0.97 0 0)` | `oklch(1 0 0 / 20%)` | hover surface (was `hover:bg-white/20`) |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | the previous `.dark` value |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | (was `border-white/10`) |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.714 0.203 305.504)` | Tailwind purple-400 |

Unchanged: `--radius`, `--chart-*`, `--sidebar-*` (no consumer).

`bg-cosmic` before: `linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a)`.
After: `linear-gradient(to bottom, var(--background), var(--popover), var(--background))` (same colours, from tokens).

Note: Tailwind publishes purple-600 at chroma 0.288 (outside sRGB); browsers gamut-map it, so it matches `bg-purple-600`
exactly as before.
