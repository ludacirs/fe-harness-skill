# CI Integration Guide

This guide covers running fe-harness tests in CI pipelines.
This is NOT automatically triggered by the skill — set up manually per project.

---

## Interaction Tests (Playwright Test)

### GitHub Actions example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npx playwright install chromium --with-deps

      - run: npm run dev &
      - run: npx wait-on http://localhost:3000

      - run: npx playwright test e2e/
```

### Key points
- Install Chromium in CI (`npx playwright install chromium --with-deps`)
- Start dev server before running tests
- Use `wait-on` to ensure server is ready

---

## Visual Regression (diff.ts)

### Prerequisites
- Baseline screenshots must be committed in `visual-qa/expected/`
- Install skill scripts deps: `cd skills/fe-harness/scripts && npm ci`

### GitHub Actions example

```yaml
- name: Visual regression
  run: |
    npx tsx skills/fe-harness/scripts/capture.ts \
      --url http://localhost:3000/page \
      --out visual-qa/actual/page.png \
      --width 1440 --height 900

    npx tsx skills/fe-harness/scripts/diff.ts \
      --expected visual-qa/expected/page-baseline.png \
      --actual visual-qa/actual/page.png \
      --diff visual-qa/diff/page.png \
      --threshold 0.5
```

### Handling failures
- diff.ts exits with code 1 on RED — CI will fail the step
- The diff image (`visual-qa/diff/`) shows exactly what changed
- Upload diff images as artifacts for review:

```yaml
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: visual-diff
    path: visual-qa/diff/
```

---

## Notes

- Interaction tests and visual regression are independent — run in parallel
- Visual regression requires baseline screenshots to exist (committed from local development)
- For the first run on a new component, there will be no baseline — skip visual regression
- Consider running visual regression only on PRs that touch frontend files
