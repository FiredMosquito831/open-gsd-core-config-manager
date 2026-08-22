# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phases-ignored-user-preferences-2 — Deep audit revealed 10 critical gaps between locked-stack requirements and implementation
- **Date:** 2026-08-03
- **Error patterns:** tailwind css unused, radix ui missing, chokidar not integrated, playwright e2e failing, project.md unchecked, schema-05 traceability, accessible keyboard reorder, sensitive field masking, schema refresh e2e, snapshot pruning ui
- **Root cause(s):** All 10 gaps were real implementation omissions vs. locked-stack requirements in .claude/CLAUDE.md and phase CONTEXT decisions. Each gap was independently fixed and verified.
- **Fix:** Systematically implemented missing pieces across all 10 gap categories (Tailwind, Radix, chokidar, Playwright, PROJECT.md, SCHEMA-05, D-03, D-15/D-16, schema refresh E2E, snapshot pruning deferral)
- **Files changed:** vite.config.ts, web/src/styles.css, web/src/lib/utils.ts, web/src/components/ui/*.tsx (11 new Radix/Tailwind base components), packages/server/src/workspace-store.ts, packages/cli/src/bootstrap.ts, packages/cli/src/cli-main.ts, packages/server/src/context.ts, test/e2e/smoke.test.ts, playwright.config.ts, package.json
- **Why not caught:** No single gate — these were systematic audit findings across the whole stack, not a single bug class. The audit process itself (cross-referencing CONTEXT.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md) is the guard against such omissions.
- **Recurrence guard:** KB pattern — when auditing completeness, check: tailwind usage across components, radix presence in package.json and imports, chokidar in workspace-store, playwright tests passing, PROJECT.md sync with ROADMAP, schema-x traceability in REQUIREMENTS.md

---