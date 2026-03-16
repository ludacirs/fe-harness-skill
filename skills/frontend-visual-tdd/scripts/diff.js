#!/usr/bin/env node
/**
 * diff.js — pixelmatch-based screenshot comparison
 *
 * This script only handles image diffing. All browser automation and
 * screenshot capture is delegated to playwright-skill.
 *
 * Usage:
 *   node diff.js --expected <path> --actual <path> --diff <path> [--threshold 0.5]
 *
 * Exit codes:
 *   0 = GREEN (mismatch ≤ threshold)
 *   1 = RED   (mismatch > threshold)
 *   2 = Error (missing files, size mismatch)
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { parseArgs } from 'util';

const { values: args } = parseArgs({
  options: {
    expected:  { type: 'string' },
    actual:    { type: 'string' },
    diff:      { type: 'string' },
    threshold: { type: 'string', default: '0.5' },  // % of total pixels
  },
  strict: false,
});

if (!args.expected || !args.actual || !args.diff) {
  console.error('Usage: node diff.js --expected <path> --actual <path> --diff <path> [--threshold 0.5]');
  process.exit(2);
}

if (!existsSync(args.expected)) {
  console.error(`[ERROR] expected image not found: ${args.expected}`);
  console.error('→ Run PHASE 0 first: extract expected.png from Figma MCP.');
  process.exit(2);
}

if (!existsSync(args.actual)) {
  console.error(`[ERROR] actual image not found: ${args.actual}`);
  console.error('→ Use playwright-skill to capture the actual screenshot first.');
  process.exit(2);
}

const expected = PNG.sync.read(readFileSync(args.expected));
const actual   = PNG.sync.read(readFileSync(args.actual));

if (expected.width !== actual.width || expected.height !== actual.height) {
  console.warn(`[WARN] Size mismatch: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
  console.warn('→ Match --width/--height in playwright-skill capture to Figma frame dimensions.');
}

const { width, height } = expected;
const diff = new PNG({ width, height });

const mismatchPx = pixelmatch(
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
  }
);

const totalPx     = width * height;
const mismatchPct = (mismatchPx / totalPx) * 100;
const threshold   = parseFloat(args.threshold);
const isGreen     = mismatchPct <= threshold;

const diffDir = dirname(args.diff);
if (!existsSync(diffDir)) mkdirSync(diffDir, { recursive: true });
writeFileSync(args.diff, PNG.sync.write(diff));

console.log('─'.repeat(50));
console.log(`Status:    ${isGreen ? 'GREEN ✅' : 'RED ❌'}`);
console.log(`Mismatch:  ${mismatchPct.toFixed(3)}%  (${mismatchPx}px / ${totalPx}px)`);
console.log(`Threshold: ${threshold}%`);
console.log(`Diff img:  ${args.diff}`);
console.log('─'.repeat(50));

if (!isGreen) {
  console.log('→ RED: fix CSS/component, then re-run playwright-skill capture + diff.js.');
  process.exit(1);
}

console.log('→ GREEN: actual matches expected.');
process.exit(0);
