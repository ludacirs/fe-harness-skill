#!/usr/bin/env tsx
/**
 * diff.ts — pixelmatch-based screenshot comparison
 *
 * Usage:
 *   npx tsx diff.ts --expected <path> --actual <path> --diff <path> [--threshold 0.5]
 *
 * Exit codes:
 *   0 = GREEN (mismatch ≤ threshold)
 *   1 = RED   (mismatch > threshold)
 *   2 = Error (missing files, size mismatch, missing deps)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { parseArgs } from 'util';
import { createRequire } from 'module';

// Guard: check deps are installed before proceeding
const require = createRequire(import.meta.url);
const missing = ['pixelmatch', 'pngjs'].filter((pkg) => {
  try { require.resolve(pkg); return false; } catch { return true; }
});
if (missing.length > 0) {
  const skillDir = new URL('../', import.meta.url).pathname;
  console.error(`[ERROR] missing packages: ${missing.join(', ')}`);
  console.error(`→ Run: cd ${skillDir}scripts && npm run setup`);
  process.exit(2);
}

const pixelmatch = (await import('pixelmatch')).default;
const { PNG }    = await import('pngjs');

// --- Args ---

const { values } = parseArgs({
  options: {
    expected:  { type: 'string' },
    actual:    { type: 'string' },
    diff:      { type: 'string' },
    threshold: { type: 'string', default: '0.5' },  // % of total pixels
  },
  strict: false,
});

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
  console.error('→ Run PHASE 0 first: extract expected.png from Figma MCP.');
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
  console.error(`[ERROR] Size mismatch: expected ${expected.width}×${expected.height}, actual ${actual.width}×${actual.height}`);
  console.error('→ Match --width/--height in capture.ts to Figma frame dimensions.');
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
const isGreen: boolean    = mismatchPct <= threshold;

const diffDir = dirname(diffPath);
if (!existsSync(diffDir)) mkdirSync(diffDir, { recursive: true });
writeFileSync(diffPath, PNG.sync.write(diff));

console.log('─'.repeat(50));
console.log(`Status:    ${isGreen ? 'GREEN ✅' : 'RED ❌'}`);
console.log(`Mismatch:  ${mismatchPct.toFixed(3)}%  (${mismatchPx}px / ${totalPx}px)`);
console.log(`Threshold: ${threshold}%`);
console.log(`Diff img:  ${args.diff}`);
console.log('─'.repeat(50));

if (!isGreen) {
  console.log('→ RED: fix CSS/component, then re-run capture.ts + diff.ts.');
  process.exit(1);
}

console.log('→ GREEN: actual matches expected.');
process.exit(0);
