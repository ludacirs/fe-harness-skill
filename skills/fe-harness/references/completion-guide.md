# Phase 7 — Completion Guide

## Artifacts that stay in the project

```
e2e/<task>.spec.ts              <- interaction tests (cumulative)
e2e/mocks/                      <- API mock data (reusable)
dev/preview/<Component>.tsx     <- preview routes (cumulative)
visual-qa/expected/             <- baseline screenshots (commit)
visual-qa/config.json           <- per-task thresholds (commit)
playwright.config.ts            <- created once, permanent
```

## .gitignore additions

```
visual-qa/actual/
visual-qa/diff/
```

## Regression: diff.ts for future changes

After baseline is established, future tasks can run:

```bash
npx tsx scripts/diff.ts \
  --expected visual-qa/expected/<task>-baseline.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold 0.5
```

This catches unintended visual regressions (browser vs browser = reliable).
