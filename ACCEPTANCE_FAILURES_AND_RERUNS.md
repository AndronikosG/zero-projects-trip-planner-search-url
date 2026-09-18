# Acceptance failures and re-runs

## Failure 1 — browser Back would not have a previous filter entry

Before the acceptance run, browser-history review found that filter edits used `router.replace`. That updated the URL without reload, but replaced the current history entry.

**Cause:** filter state changes used replacement navigation.

**Fix:** changed filter updates to `router.push(..., { scroll: false })`, so browser Back can restore the previous normalized search state while still avoiding a full reload.

## Failure 2 — first automated browser run never reached results

The first CI browser attempt timed out on the cold-load row. The page rendered the controls and URL strip but stayed on `Loading accommodation…`. The server log showed Next.js blocking development resources because the harness opened `127.0.0.1` while the dev server was serving `localhost`.

**Cause:** acceptance-harness origin mismatch, not search URL logic.

**Fix:** changed the browser base URL and readiness probe to `http://localhost:3000`, matching the Next.js dev origin.

## Failure 3 — committed server.log came from the wrong process

The previous final `server.log` was produced by a second `next dev` launch after the first acceptance server had not fully exited. That second launch only logged the lock/startup error, while the browser was still being served by the first process.

**Cause:** the two acceptance passes started separate dev-server processes, so the file copied for the final pass was not guaranteed to belong to the process that actually handled the requests.

**Fix:** both acceptance passes now run against one shared Next.js process. Its stdout is captured once to `acceptance-server.log`, copied into both evidence folders, and CI fails if that file does not contain `[accommodation-search]` route-handler lines.

## Re-run evidence

`ACCEPTANCE_EVIDENCE_FIRST_PASS.md` and `evidence/search-url/first-pass/` contain the first complete browser pass after the fixes. `ACCEPTANCE_EVIDENCE.md` and `evidence/search-url/final/` contain a clean rerun of the same matrix. Every row includes the exact `/api/search` request count and a screenshot, and the committed `server.log` now contains the raw route-handler output from the process that actually served both runs.
