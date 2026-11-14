---
change_id: dashboard-ui-cleanup
title: Dashboard UI cleanup
status: implementing
created: 2026-11-14
updated: 2026-11-14
archived_at: null
---

## Notes

UI change via /10x-ui (cleanup, not restyle).

- **View:** `src/pages/dashboard.astro` (one view only).
- **Token source:** `src/styles/global.css` (`:root` / `.dark` + `@theme inline`, shadcn neutral values).
- **Contract variant:** fresh starter with a dead token file. The view reads no tokens and imports no `src/components/ui` component; Phase 1 makes it read the existing tokens. No second `shadcn init`.
- **Pre-audit:** 10 hard-coded hits in the view, 0 token classes, 0 ui imports. `bg-cosmic` (hex in `global.css`) is used in 11 files. `Topbar.astro` duplicates nav with `purple-300`.
- **Open decision for the plan:** map the cosmic look onto theme tokens, or defer `bg-cosmic` to avoid touching the other 10 views.
