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
 *   --url          Target URL (required)
 *   --out          Output path, e.g. visual-qa/actual/login.png (required)
 *   --type         component | page | flow  (default: page)
 *   --width        Viewport width  (default: 1440)
 *   --height       Viewport height (default: 900)
 *   --steps        Path to flow steps JSON (required when --type flow)
 *   --mock-routes  Path to mock routes JSON for API interception (optional)
 *   --wait         networkidle | load | domcontentloaded (default: networkidle)
 *   --timeout      Navigation timeout in ms (default: 30000)
 *   --headless     true | false (default: true)
 *
 * Mock routes format: see references/mock-routes-example.json
 * Flow steps format:  see references/flow-steps-example.json
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { parseArgs } from 'util';
import { createRequire } from 'module';

// Guard: check playwright is installed before proceeding
const require = createRequire(import.meta.url);
try {
  require.resolve('playwright');
} catch {
  const skillDir = new URL('../', import.meta.url).pathname;
  console.error('[ERROR] playwright is not installed.');
  console.error(`→ Run: cd ${skillDir}scripts && npm run setup`);
  process.exit(1);
}

const { chromium } = await import('playwright');

// --- Types ---

interface FlowStep {
  click?: string;
  fill?: { selector: string; value: string };
  waitFor?: string;
  waitForState?: 'networkidle' | 'load' | 'domcontentloaded';
  sleep?: number;
}

interface MockRoute {
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
    url:           { type: 'string' },
    out:           { type: 'string' },
    type:          { type: 'string', default: 'page' },
    width:         { type: 'string', default: '1440' },
    height:        { type: 'string', default: '900' },
    steps:         { type: 'string' },
    'mock-routes': { type: 'string' },
    wait:          { type: 'string', default: 'networkidle' },
    timeout:       { type: 'string', default: '30000' },
    headless:      { type: 'string', default: 'true' },
  },
  strict: false,
});

const args = values as Record<string, string | undefined>;

if (!args.url || !args.out) {
  console.error('Usage: npx tsx capture.ts --url <url> --out <path> [--type page|component|flow]');
  process.exit(1);
}

const url = args.url;
const out = args.out;
const captureType = (args.type ?? 'page') as CaptureType;
const waitState = (args.wait ?? 'networkidle') as WaitState;
const stepsPath = args.steps;
const mockRoutesPath = args['mock-routes'];
const timeoutMs = parseInt(args.timeout ?? '30000');
const viewportWidth = parseInt(args.width ?? '1440');
const viewportHeight = parseInt(args.height ?? '900');
const headless = args.headless !== 'false';

if (captureType === 'flow' && !stepsPath) {
  console.error('[ERROR] --steps <json> is required for --type flow');
  console.error('See references/flow-steps-example.json for the format.');
  process.exit(1);
}

const outDir = dirname(out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);

  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

  // --- API route mocking (page/flow types) ---
  // For component type, prefer MSW handlers in .preview.tsx instead.
  if (mockRoutesPath) {
    const mockRoutes: MockRoute[] = JSON.parse(readFileSync(mockRoutesPath, 'utf-8'));
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

  await page.goto(url);
  await page.waitForLoadState(waitState);

  if (captureType === 'flow') {
    const steps: FlowStep[] = JSON.parse(readFileSync(stepsPath!, 'utf-8'));

    for (const [i, step] of steps.entries()) {
      const padded  = String(i + 1).padStart(2, '0');
      const stepOut = out.replace(/(\.\w+)$/, `-step-${padded}$1`);
      const stepDir = dirname(stepOut);
      if (!existsSync(stepDir)) mkdirSync(stepDir, { recursive: true });

      if (step.click)        await page.click(step.click);
      if (step.fill)         await page.fill(step.fill.selector, step.fill.value);
      if (step.waitFor)      await page.waitForSelector(step.waitFor);
      if (step.waitForState) await page.waitForLoadState(step.waitForState);
      if (step.sleep)        await page.waitForTimeout(step.sleep);

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
