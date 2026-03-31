# CI Integration Guide

This guide covers running fe-harness tests in CI pipelines.
This is NOT automatically triggered by the skill — set up manually per project.

---

## Baseline Path Convention

Use a structured path for baseline screenshots:

```
__baselines__/{route}/{step}.png
```

Examples:
- `__baselines__/home/default.png`
- `__baselines__/login/form-filled.png`
- `__baselines__/dashboard/sidebar-collapsed.png`

Route-level directories keep baselines organized and discoverable.

### Migration from `visual-qa/expected/`

If your project uses the older `visual-qa/expected/` flat layout:

```bash
# Example: migrate home-baseline.png to structured path
mkdir -p __baselines__/home
mv visual-qa/expected/home-baseline.png __baselines__/home/default.png
```

Both paths are supported — the skill writes to whichever path you specify in `--out`.

---

## Interaction Tests (Playwright Test)

### Self-contained execution

Generated tests should run with a single command:

```bash
npx playwright test e2e/
```

To achieve this, configure `webServer` in `playwright.config.ts` so CI does not
need a separately managed dev server:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

### Required dependencies in `package.json`

Ensure these are listed so `npm ci` installs everything:

```json
{
  "devDependencies": {
    "playwright": "^1.x",
    "@playwright/test": "^1.x",
    "tsx": "^4.x"
  }
}
```

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

      # webServer config in playwright.config.ts starts the dev server automatically
      - run: npx playwright test e2e/
```

### Key points
- Install Chromium in CI (`npx playwright install chromium --with-deps`)
- Use `webServer` in playwright.config.ts — no need for manual `npm run dev &` + `wait-on`
- `reuseExistingServer: !process.env.CI` avoids port conflicts locally

---

## Visual Regression (diff.ts)

### Prerequisites
- Baseline screenshots must be committed (e.g. `__baselines__/` or `visual-qa/expected/`)
- Deterministic mode is on by default in `capture.ts` — no extra setup needed in CI

### Deterministic capture in CI

`capture.ts` runs with `--deterministic true` by default, which:
- Freezes `Date.now()` and `new Date()` to `2024-01-01T00:00:00Z`
- Seeds `Math.random()` for consistent output
- Disables all CSS animations and transitions
- Makes `requestAnimationFrame` synchronous

This ensures identical screenshots across local and CI environments.

### Stability wait in CI

`capture.ts` also runs with `--stability-wait true` by default, which waits for:
- Font loading (`document.fonts.ready`)
- DOM mutation settle (300ms quiet period)
- All animations finished
- Network idle

This prevents flaky failures from incomplete rendering.

### GitHub Actions example

```yaml
- name: Visual regression
  run: |
    npx tsx skills/fe-visual-tdd/scripts/capture.ts \
      --url http://localhost:3000/page \
      --out visual-qa/actual/page.png \
      --width 1440 --height 900

    npx tsx skills/fe-visual-tdd/scripts/diff.ts \
      --expected __baselines__/page/default.png \
      --actual visual-qa/actual/page.png \
      --diff visual-qa/diff/page.png \
      --threshold 0.5 \
      --output-json visual-qa/results/page.json
```

### JSON result output for CI scripting

Use `--output-json <path>` to write structured results to a file:

```bash
npx tsx diff.ts \
  --expected baseline.png --actual actual.png --diff diff.png \
  --output-json results/diff-result.json
```

The JSON file contains:
```json
{
  "status": "GREEN",
  "mismatchPct": 0.012,
  "mismatchPx": 24,
  "totalPx": 200000,
  "threshold": 0.5,
  "diffImage": "visual-qa/diff/page.png",
  "engine": "odiff",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "images": {
    "expected": "__baselines__/page/default.png",
    "actual": "visual-qa/actual/page.png"
  }
}
```

CI scripts can parse this to generate PR comments with diff details.

### Handling failures
- diff.ts exits with code 1 on RED — CI will fail the step
- The diff image shows exactly what changed
- Upload diff images and JSON results as artifacts for review:

```yaml
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: visual-diff
    path: |
      visual-qa/diff/
      visual-qa/results/
```

---

## Deterministic Scripts in Generated Tests

When generating Playwright tests that include screenshot assertions, embed the
deterministic setup as a `beforeEach` hook:

```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Deterministic rendering for visual stability
  await page.addInitScript(() => {
    const FIXED_TIME = 1704067200000;
    const _OrigDate = Date;
    Date.now = () => FIXED_TIME;
    const FixedDate = function(...args: any[]) {
      if (args.length === 0) return new _OrigDate(FIXED_TIME);
      return new _OrigDate(...args);
    };
    FixedDate.now = () => FIXED_TIME;
    FixedDate.parse = _OrigDate.parse;
    FixedDate.UTC = _OrigDate.UTC;
    FixedDate.prototype = _OrigDate.prototype;
    (window as any).Date = FixedDate;

    let _seed = 42;
    Math.random = () => {
      _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
      let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  });
});
```

This ensures CI tests produce the same renders as local `capture.ts --deterministic true`.

---

## Notes

- Interaction tests and visual regression are independent — run in parallel
- Visual regression requires baseline screenshots to exist (committed from local development)
- For the first run on a new component, there will be no baseline — skip visual regression
- Consider running visual regression only on PRs that touch frontend files
- The `--engine` flag on diff.ts selects odiff (default, faster) or pixelmatch (fallback)
- Use `--ignore-regions` on diff.ts to exclude dynamic areas (ads, third-party widgets)
