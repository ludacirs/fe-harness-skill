#!/usr/bin/env tsx
/**
 * capture.ts — Playwright screenshot capture
 *
 * Standalone — no dependency on playwright-skill.
 *
 * Usage:
 *   npx tsx capture.ts --url <url> --out <path> [options]
 *
 * Options:
 *   --url              Target URL (required)
 *   --out              Output path, e.g. visual-qa/actual/login.png (required)
 *   --type             component | page | flow  (default: page)
 *   --width            Viewport width  (default: 1440)
 *   --height           Viewport height (default: 900)
 *   --steps            Path to flow steps JSON (required when --type flow)
 *   --mock-routes      Path to mock routes JSON for API interception (optional)
 *   --wait             networkidle | load | domcontentloaded (default: networkidle)
 *   --timeout          Navigation timeout in ms (default: 30000)
 *   --headless         true | false (default: true)
 *   --deterministic    true | false (default: true) — freeze Date/Math.random, disable animations
 *   --stability-wait   true | false (default: true) — multi-layer stability checks before screenshot
 *
 * Mock routes format: see references/mock-routes-example.json
 * Flow steps format:  see references/flow-steps-example.json
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, resolve, isAbsolute } from 'path';
import { parseArgs } from 'util';
import { chromium } from 'playwright';

// Resolve file paths relative to the caller's working directory, not the script's location.
// ORIGINAL_CWD is an optional safety net for wrapper scripts that change cwd before invoking.
const callerCwd = process.env.ORIGINAL_CWD || process.cwd();
function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(callerCwd, p);
}

// --- Types ---

interface FlowStep {
  _comment?: string;
  click?: string;
  fill?: { selector: string; value: string };
  waitFor?: string;
  waitForState?: 'networkidle' | 'load' | 'domcontentloaded';
  sleep?: number;
}

interface MockRoute {
  _comment?: string;
  pattern: string;
  abort?: boolean;
  status?: number;
  contentType?: string;
  body?: string;
  response?: unknown;
}

type CaptureType = 'component' | 'page' | 'flow';
type WaitState = 'networkidle' | 'load' | 'domcontentloaded';

// --- Args ---

const { values } = parseArgs({
  options: {
    help:             { type: 'boolean', short: 'h' },
    url:              { type: 'string' },
    out:              { type: 'string' },
    type:             { type: 'string', default: 'page' },
    width:            { type: 'string', default: '1440' },
    height:           { type: 'string', default: '900' },
    steps:            { type: 'string' },
    'mock-routes':    { type: 'string' },
    wait:             { type: 'string', default: 'networkidle' },
    timeout:          { type: 'string', default: '30000' },
    headless:         { type: 'string', default: 'true' },
    deterministic:    { type: 'string', default: 'true' },
    'stability-wait': { type: 'string', default: 'true' },
  },
  strict: false,
});

if (values.help) {
  console.log(`Usage: npx tsx capture.ts --url <url> --out <path> [options]

Capture a Playwright screenshot of a page, component, or multi-step flow.

Options:
  --url              Target URL (required)
  --out              Output path, e.g. visual-qa/actual/login.png (required)
  --type             component | page | flow  (default: page)
  --width            Viewport width  (default: 1440)
  --height           Viewport height (default: 900)
  --steps            Path to flow steps JSON (required when --type flow)
  --mock-routes      Path to mock routes JSON for API interception
  --wait             networkidle | load | domcontentloaded (default: networkidle)
  --timeout          Navigation timeout in ms (default: 30000)
  --headless         true | false (default: true)
  --deterministic    true | false (default: true) — freeze Date/Math.random, disable CSS animations
  --stability-wait   true | false (default: true) — multi-layer rendering stability checks

Examples:
  npx tsx capture.ts --url http://localhost:3000 --out visual-qa/actual/home.png
  npx tsx capture.ts --url 'http://localhost:3000/dev/preview?component=Login' --out visual-qa/actual/login.png --type component
  npx tsx capture.ts --url http://localhost:3000 --out visual-qa/actual/flow.png --type flow --steps steps.json
  npx tsx capture.ts --url http://localhost:3000 --out visual-qa/actual/home.png --deterministic false`);
  process.exit(0);
}

const args = values as Record<string, string | undefined>;

if (!args.url || !args.out) {
  console.error('Usage: npx tsx capture.ts --url <url> --out <path> [--type page|component|flow]');
  process.exit(1);
}

const url = args.url;
const out = resolvePath(args.out!);
const captureType = (args.type ?? 'page') as CaptureType;
const waitState = (args.wait ?? 'networkidle') as WaitState;
const stepsPath = args.steps ? resolvePath(args.steps) : undefined;
const mockRoutesPath = args['mock-routes'] ? resolvePath(args['mock-routes']) : undefined;
const timeoutMs = parseInt(args.timeout ?? '30000');
const viewportWidth = parseInt(args.width ?? '1440');
const viewportHeight = parseInt(args.height ?? '900');
const headless = args.headless !== 'false';
const deterministic = args.deterministic !== 'false';
const stabilityWait = args['stability-wait'] !== 'false';

if (captureType === 'flow' && !stepsPath) {
  console.error('[ERROR] --steps <json> is required for --type flow');
  console.error('See references/flow-steps-example.json for the format.');
  process.exit(1);
}

const VALID_TYPES = ['component', 'page', 'flow'] as const;
if (!VALID_TYPES.includes(captureType as typeof VALID_TYPES[number])) {
  console.error(`[ERROR] Invalid type "${captureType}". Must be one of: ${VALID_TYPES.join(', ')}`);
  process.exit(1);
}

// Parse JSON files before launching browser to avoid browser leak on parse errors
let mockRoutes: MockRoute[] | undefined;
if (mockRoutesPath) {
  try {
    mockRoutes = JSON.parse(readFileSync(mockRoutesPath, 'utf-8'));
  } catch (e) {
    console.error(`[ERROR] Failed to parse mock-routes JSON: ${mockRoutesPath}`);
    console.error(String(e));
    process.exit(1);
  }
}

let flowSteps: FlowStep[] | undefined;
if (captureType === 'flow' && stepsPath) {
  try {
    flowSteps = JSON.parse(readFileSync(stepsPath, 'utf-8'));
  } catch (e) {
    console.error(`[ERROR] Failed to parse flow steps JSON: ${stepsPath}`);
    console.error(String(e));
    process.exit(1);
  }
}

// --- Deterministic script (issue #40) ---
// Injected via addInitScript before any page JS runs.
// Freezes non-deterministic browser APIs to ensure reproducible screenshots.
const DETERMINISTIC_SCRIPT = `
  // Freeze Date to a fixed epoch (2024-01-01T00:00:00Z)
  const FIXED_TIME = 1704067200000;
  const _OrigDate = Date;
  const _origNow = Date.now;
  Date.now = () => FIXED_TIME;
  const FixedDate = function(...args) {
    if (args.length === 0) return new _OrigDate(FIXED_TIME);
    return new _OrigDate(...args);
  };
  FixedDate.now = () => FIXED_TIME;
  FixedDate.parse = _OrigDate.parse;
  FixedDate.UTC = _OrigDate.UTC;
  FixedDate.prototype = _OrigDate.prototype;
  window.Date = FixedDate;

  // Seed-based Math.random (mulberry32)
  let _seed = 42;
  Math.random = () => {
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Disable CSS animations and transitions
  const style = document.createElement('style');
  style.textContent = \`
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(style);

  // Force requestAnimationFrame to execute synchronously
  const _origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => {
    cb(FIXED_TIME);
    return 0;
  };
`;

// --- Stability wait pipeline (issue #41) ---
// Sequential checks before screenshot to ensure rendering is complete.
// Each step has its own timeout to prevent infinite waits.

async function waitForStability(page: import('playwright').Page): Promise<void> {
  // Step 1: Font loading (timeout: 5s)
  await page.evaluate(() => {
    return Promise.race([
      document.fonts.ready,
      new Promise(r => setTimeout(r, 5000)),
    ]);
  });

  // Step 2: DOM mutation settle — 300ms of no DOM changes (timeout: 5s)
  await page.evaluate(() => new Promise<void>(resolve => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = setTimeout(() => { observer.disconnect(); resolve(); }, 5000);
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { clearTimeout(timeout); observer.disconnect(); resolve(); }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    timer = setTimeout(() => { clearTimeout(timeout); observer.disconnect(); resolve(); }, 300);
  }));

  // Step 3: All animations finished (timeout: 3s)
  await page.evaluate(() => {
    const animations = document.getAnimations();
    if (animations.length === 0) return Promise.resolve();
    return Promise.race([
      Promise.all(animations.map(a => a.finished.catch(() => {}))),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  });

  // Step 4: No pending network — check with a brief idle period (timeout: 3s)
  await page.waitForLoadState('networkidle').catch(() => {});
}

const outDir = dirname(out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);

  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

  // --- Deterministic mode (issue #40) ---
  if (deterministic) {
    await page.addInitScript(DETERMINISTIC_SCRIPT);
    console.log('[deterministic] Date, Math.random, CSS animations frozen');
  }

  // --- API route mocking (page/flow types) ---
  // For component type, prefer MSW handlers in .preview.tsx instead.
  if (mockRoutes) {
    for (const mock of mockRoutes) {
      await page.route(mock.pattern, async (route) => {
        if (mock.abort) {
          await route.abort();
          return;
        }
        await route.fulfill({
          status:      mock.status ?? 200,
          contentType: mock.contentType ?? 'application/json',
          body:        mock.body ?? JSON.stringify(mock.response ?? {}),
        });
      });
    }
    console.log(`[mock] ${mockRoutes.length} route(s) intercepted`);
  }

  await page.goto(url, { waitUntil: waitState });

  // --- Stability wait (issue #41) ---
  if (stabilityWait) {
    await waitForStability(page);
    console.log('[stability] all checks passed');
  }

  if (captureType === 'flow') {
    for (const [i, step] of flowSteps!.entries()) {
      const padded  = String(i + 1).padStart(2, '0');
      const stepOut = out.replace(/(\.\w+)$/, `-step-${padded}$1`);
      const stepDir = dirname(stepOut);
      if (!existsSync(stepDir)) mkdirSync(stepDir, { recursive: true });

      if (step.click)        await page.click(step.click);
      if (step.fill)         await page.fill(step.fill.selector, step.fill.value);
      if (step.waitFor)      await page.waitForSelector(step.waitFor);
      if (step.waitForState) await page.waitForLoadState(step.waitForState);
      if (step.sleep)        await page.waitForTimeout(step.sleep);

      if (stabilityWait) await waitForStability(page);

      await page.screenshot({ path: stepOut, fullPage: false });
      console.log(`[step ${padded}] → ${stepOut}`);
    }
  } else {
    await page.screenshot({
      path:     out,
      fullPage: captureType === 'page',
    });
    console.log(`captured → ${out}`);
  }
} finally {
  await browser.close();
}
