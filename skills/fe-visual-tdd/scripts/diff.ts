#!/usr/bin/env tsx
/**
 * diff.ts — pixelmatch-based screenshot comparison
 *
 * FOR REGRESSION ONLY (browser vs browser).
 * Do NOT use for Figma vs browser comparison — use Claude visual comparison instead.
 *
 * Usage:
 *   npx tsx diff.ts --expected <path> --actual <path> --diff <path> [--threshold 0.5]
 *
 * Exit codes:
 *   0 = GREEN (mismatch <= threshold)
 *   1 = RED   (mismatch > threshold)
 *   2 = Error (missing files, size mismatch, missing deps)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { parseArgs } from 'util';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// --- Args ---

const { values } = parseArgs({
  options: {
    help:      { type: 'boolean', short: 'h' },
    json:      { type: 'boolean' },
    expected:  { type: 'string' },
    actual:    { type: 'string' },
    diff:      { type: 'string' },
    threshold: { type: 'string', default: '0.5' },  // % of total pixels
  },
  strict: false,
});

if (values.help) {
  console.log(`Usage: npx tsx diff.ts --expected <path> --actual <path> --diff <path> [options]

Pixel-level screenshot comparison for visual regression (browser vs browser ONLY).

Options:
  --expected   Path to baseline screenshot (required)
  --actual     Path to current screenshot (required)
  --diff       Path to write diff image (required)
  --threshold  Max allowed mismatch percentage (default: 0.5)
  --json       Output result as JSON instead of formatted text

Exit codes:
  0 = GREEN (mismatch <= threshold)
  1 = RED   (mismatch > threshold)
  2 = Error (missing files, size mismatch, invalid args)

Examples:
  npx tsx diff.ts --expected visual-qa/expected/home-baseline.png --actual visual-qa/actual/home.png --diff visual-qa/diff/home.png
  npx tsx diff.ts --expected baseline.png --actual actual.png --diff diff.png --threshold 1.0 --json`);
  process.exit(0);
}

const outputJson = !!values.json;
const args = values as Record<string, string | undefined>;

if (!args.expected || !args.actual || !args.diff) {
  console.error('Usage: npx tsx diff.ts --expected <path> --actual <path> --diff <path> [--threshold 0.5]');
  process.exit(2);
}

const expectedPath = args.expected;
const actualPath   = args.actual;
const diffPath     = args.diff;

if (!existsSync(expectedPath)) {
  console.error(`[ERROR] expected image not found: ${expectedPath}`);
  console.error('→ Run PHASE 0 first: extract expected.png via figma-export.ts.');
  process.exit(2);
}

if (!existsSync(actualPath)) {
  console.error(`[ERROR] actual image not found: ${actualPath}`);
  console.error('→ Run capture.ts to capture the actual screenshot first.');
  process.exit(2);
}

const expected = PNG.sync.read(readFileSync(expectedPath));
const actual   = PNG.sync.read(readFileSync(actualPath));

if (expected.width !== actual.width || expected.height !== actual.height) {
  console.error(`[ERROR] Size mismatch: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
  console.error('→ Match --width/--height in capture.ts to baseline dimensions.');
  process.exit(2);
}

const { width, height } = expected;
const diff = new PNG({ width, height });

const mismatchPx: number = pixelmatch(
  expected.data,
  actual.data,
  diff.data,
  width,
  height,
  {
    threshold:    0.1,           // per-pixel color sensitivity
    includeAA:    false,         // ignore anti-aliasing differences
    alpha:        0.1,
    diffColor:    [255, 0, 0],   // red: mismatched pixels
    diffColorAlt: [0, 255, 0],   // green: anti-aliased pixels
  },
);

const totalPx: number     = width * height;
const mismatchPct: number = (mismatchPx / totalPx) * 100;
const threshold: number   = parseFloat(args.threshold ?? '0.5');

if (isNaN(threshold) || threshold < 0) {
  console.error(`[ERROR] Invalid threshold value: "${args.threshold}". Must be a non-negative number.`);
  process.exit(2);
}

const isGreen: boolean    = mismatchPct <= threshold;

const diffDir = dirname(diffPath);
if (!existsSync(diffDir)) mkdirSync(diffDir, { recursive: true });
writeFileSync(diffPath, PNG.sync.write(diff));

const result = {
  status: isGreen ? 'GREEN' as const : 'RED' as const,
  mismatchPct: parseFloat(mismatchPct.toFixed(3)),
  mismatchPx,
  totalPx,
  threshold,
  diffImage: args.diff,
};

if (outputJson) {
  console.log(JSON.stringify(result));
} else {
  console.log('-'.repeat(50));
  console.log(`Status:    ${result.status}`);
  console.log(`Mismatch:  ${mismatchPct.toFixed(3)}%  (${mismatchPx}px / ${totalPx}px)`);
  console.log(`Threshold: ${threshold}%`);
  console.log(`Diff img:  ${args.diff}`);
  console.log('-'.repeat(50));

  if (!isGreen) {
    console.log('→ RED: fix CSS/component, then re-run capture.ts + diff.ts.');
  } else {
    console.log('→ GREEN: actual matches baseline.');
  }
}

process.exit(isGreen ? 0 : 1);
