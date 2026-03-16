#!/usr/bin/env node
/**
 * capture.js — Playwright screenshot capture
 *
 * Standalone — no dependency on playwright-skill.
 *
 * Usage:
 *   node capture.js --url <url> --out <path> [options]
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

import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { parseArgs } from 'util';

const { values: args } = parseArgs({
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

if (!args.url || !args.out) {
  console.error('Usage: node capture.js --url <url> --out <path> [--type page|component|flow]');
  process.exit(1);
}

if (args.type === 'flow' && !args.steps) {
  console.error('[ERROR] --steps <json> is required for --type flow');
  console.error('See references/flow-steps-example.json for the format.');
  process.exit(1);
}

const outDir = dirname(args.out);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: args.headless !== 'false' });
const page = await browser.newPage();
page.setDefaultTimeout(parseInt(args.timeout));

await page.setViewportSize({
  width:  parseInt(args.width),
  height: parseInt(args.height),
});

// --- API route mocking (page/flow types) ---
// For component type, prefer MSW handlers in .preview.tsx instead.
if (args['mock-routes']) {
  const mockRoutes = JSON.parse(readFileSync(args['mock-routes'], 'utf-8'));
  for (const mock of mockRoutes) {
    await page.route(mock.pattern, route => {
      if (mock.abort) {
        route.abort();
        return;
      }
      route.fulfill({
        status:      mock.status  ?? 200,
        contentType: mock.contentType ?? 'application/json',
        body:        mock.body    ?? JSON.stringify(mock.response ?? {}),
      });
    });
  }
  console.log(`[mock] ${mockRoutes.length} route(s) intercepted`);
}

await page.goto(args.url);
await page.waitForLoadState(args.wait);

if (args.type === 'flow') {
  const steps = JSON.parse(readFileSync(args.steps, 'utf-8'));

  for (const [i, step] of steps.entries()) {
    const padded  = String(i + 1).padStart(2, '0');
    const stepOut = args.out.replace(/(\.\w+)$/, `-step-${padded}$1`);
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
    path:     args.out,
    fullPage: args.type === 'page',
  });
  console.log(`captured → ${args.out}`);
}

await browser.close();
