#!/usr/bin/env tsx
/**
 * diff.ts — Screenshot comparison with odiff or pixelmatch
 *
 * FOR REGRESSION ONLY (browser vs browser).
 * Do NOT use for Figma vs browser comparison — use Claude visual comparison instead.
 *
 * Usage:
 *   npx tsx diff.ts --expected <path> --actual <path> --diff <path> [options]
 *
 * Options:
 *   --expected        Path to baseline screenshot (required)
 *   --actual          Path to current screenshot (required)
 *   --diff            Path to write diff image (required)
 *   --threshold       Max allowed mismatch percentage (default: 0.5)
 *   --engine          odiff | pixelmatch (default: odiff, falls back to pixelmatch)
 *   --ignore-regions  Ignore regions: "x1,y1,x2,y2;..." or path to JSON file
 *   --json            Output result as JSON to stdout
 *   --output-json     Write result JSON to a file path (for CI integration)
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

// --- Types ---

interface IgnoreRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DiffResult {
  status: 'GREEN' | 'RED';
  mismatchPct: number;
  mismatchPx: number;
  totalPx: number;
  threshold: number;
  diffImage: string;
  engine: 'odiff' | 'pixelmatch';
  timestamp: string;
  images: {
    expected: string;
    actual: string;
  };
}

// --- Args ---

const { values } = parseArgs({
  options: {
    help:             { type: 'boolean', short: 'h' },
    json:             { type: 'boolean' },
    'output-json':    { type: 'string' },
    expected:         { type: 'string' },
    actual:           { type: 'string' },
    diff:             { type: 'string' },
    threshold:        { type: 'string', default: '0.5' },
    engine:           { type: 'string', default: 'odiff' },
    'ignore-regions': { type: 'string' },
  },
  strict: false,
});

if (values.help) {
  console.log(`Usage: npx tsx diff.ts --expected <path> --actual <path> --diff <path> [options]

Pixel-level screenshot comparison for visual regression (browser vs browser ONLY).

Options:
  --expected        Path to baseline screenshot (required)
  --actual          Path to current screenshot (required)
  --diff            Path to write diff image (required)
  --threshold       Max allowed mismatch percentage (default: 0.5)
  --engine          odiff | pixelmatch (default: odiff, auto-fallback to pixelmatch)
  --ignore-regions  Regions to exclude: "x1,y1,x2,y2;..." or JSON file path
  --json            Output result as JSON to stdout
  --output-json     Write result JSON to a file path (for CI integration)

Exit codes:
  0 = GREEN (mismatch <= threshold)
  1 = RED   (mismatch > threshold)
  2 = Error (missing files, size mismatch, invalid args)

Examples:
  npx tsx diff.ts --expected baseline.png --actual actual.png --diff diff.png
  npx tsx diff.ts --expected baseline.png --actual actual.png --diff diff.png --engine pixelmatch
  npx tsx diff.ts --expected baseline.png --actual actual.png --diff diff.png --ignore-regions "10,10,200,50;500,0,600,100"
  npx tsx diff.ts --expected baseline.png --actual actual.png --diff diff.png --output-json results/diff.json`);
  process.exit(0);
}

const outputJson = !!values.json;
const outputJsonPath = values['output-json'] as string | undefined;
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

const threshold: number = parseFloat(args.threshold ?? '0.5');
if (isNaN(threshold) || threshold < 0) {
  console.error(`[ERROR] Invalid threshold value: "${args.threshold}". Must be a non-negative number.`);
  process.exit(2);
}

// --- Parse ignore regions ---

function parseIgnoreRegions(input: string): IgnoreRegion[] {
  // If input is a file path, read it
  if (existsSync(input)) {
    try {
      const data = JSON.parse(readFileSync(input, 'utf-8'));
      if (Array.isArray(data)) {
        return data.map((r: any) => ({
          x1: r.x1 ?? r[0],
          y1: r.y1 ?? r[1],
          x2: r.x2 ?? r[2],
          y2: r.y2 ?? r[3],
        }));
      }
    } catch (e) {
      console.error(`[ERROR] Failed to parse ignore regions JSON: ${input}`);
      process.exit(2);
    }
  }

  // Parse inline format: "x1,y1,x2,y2;x3,y3,x4,y4"
  return input.split(';').map(segment => {
    const parts = segment.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.error(`[ERROR] Invalid ignore region format: "${segment}". Expected: x1,y1,x2,y2`);
      process.exit(2);
    }
    return { x1: parts[0], y1: parts[1], x2: parts[2], y2: parts[3] };
  });
}

const ignoreRegions: IgnoreRegion[] = args['ignore-regions']
  ? parseIgnoreRegions(args['ignore-regions'])
  : [];

// --- Engine selection ---

let engineName: 'odiff' | 'pixelmatch' = (args.engine ?? 'odiff') as 'odiff' | 'pixelmatch';

if (engineName !== 'odiff' && engineName !== 'pixelmatch') {
  console.error(`[ERROR] Invalid engine "${engineName}". Must be: odiff | pixelmatch`);
  process.exit(2);
}

// Try to load odiff, fallback to pixelmatch
let odiffCompare: ((expected: string, actual: string, diff: string, options?: any) => Promise<any>) | null = null;

if (engineName === 'odiff') {
  try {
    const odiff = await import('odiff-bin');
    odiffCompare = odiff.compare ?? odiff.default?.compare;
    if (!odiffCompare) throw new Error('compare function not found');
  } catch {
    console.warn('[WARN] odiff-bin not installed. Falling back to pixelmatch.');
    console.warn('→ Install with: npm install -D odiff-bin');
    engineName = 'pixelmatch';
  }
}

// --- Mask ignore regions for pixelmatch ---

function maskIgnoreRegions(img: PNG, regions: IgnoreRegion[]): void {
  for (const r of regions) {
    const x1 = Math.max(0, r.x1);
    const y1 = Math.max(0, r.y1);
    const x2 = Math.min(img.width, r.x2);
    const y2 = Math.min(img.height, r.y2);
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const idx = (y * img.width + x) * 4;
        // Paint magenta to make masked areas visible in diff
        img.data[idx]     = 128;  // R
        img.data[idx + 1] = 128;  // G
        img.data[idx + 2] = 128;  // B
        img.data[idx + 3] = 255;  // A
      }
    }
  }
}

// --- Run comparison ---

let mismatchPx: number;
let totalPx: number;

const diffDir = dirname(diffPath);
if (!existsSync(diffDir)) mkdirSync(diffDir, { recursive: true });

if (engineName === 'odiff' && odiffCompare) {
  // --- odiff engine ---
  const odiffOptions: Record<string, unknown> = {
    threshold: 0.1,
    antialiasing: true,
    outputDiffMask: true,
  };

  if (ignoreRegions.length > 0) {
    odiffOptions.ignoreRegions = ignoreRegions.map(r => ({
      x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2,
    }));
  }

  try {
    const result = await odiffCompare(expectedPath, actualPath, diffPath, odiffOptions);

    if (result.match === true || result.match === 'images-match') {
      mismatchPx = 0;
    } else {
      mismatchPx = result.diffCount ?? result.diffPixels ?? 0;
    }

    // Read image dimensions for totalPx
    const expected = PNG.sync.read(readFileSync(expectedPath));
    totalPx = expected.width * expected.height;
  } catch (e) {
    // odiff may throw on size mismatch
    const msg = String(e);
    if (msg.includes('size') || msg.includes('dimension')) {
      const expected = PNG.sync.read(readFileSync(expectedPath));
      const actual = PNG.sync.read(readFileSync(actualPath));
      console.error(`[ERROR] Size mismatch: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
      console.error('→ Match --width/--height in capture.ts to baseline dimensions.');
    } else {
      console.error(`[ERROR] odiff comparison failed: ${msg}`);
    }
    process.exit(2);
  }
} else {
  // --- pixelmatch engine ---
  const expected = PNG.sync.read(readFileSync(expectedPath));
  const actual   = PNG.sync.read(readFileSync(actualPath));

  if (expected.width !== actual.width || expected.height !== actual.height) {
    console.error(`[ERROR] Size mismatch: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
    console.error('→ Match --width/--height in capture.ts to baseline dimensions.');
    process.exit(2);
  }

  const { width, height } = expected;
  totalPx = width * height;

  // Mask ignore regions on both images
  if (ignoreRegions.length > 0) {
    maskIgnoreRegions(expected, ignoreRegions);
    maskIgnoreRegions(actual, ignoreRegions);
  }

  const diff = new PNG({ width, height });

  mismatchPx = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    width,
    height,
    {
      threshold:    0.1,
      includeAA:    false,
      alpha:        0.1,
      diffColor:    [255, 0, 0],
      diffColorAlt: [0, 255, 0],
    },
  );

  writeFileSync(diffPath, PNG.sync.write(diff));
}

// --- Output ---

const mismatchPct: number = totalPx === 0 ? 0 : (mismatchPx / totalPx) * 100;
const isGreen: boolean = mismatchPct <= threshold;

const result: DiffResult = {
  status: isGreen ? 'GREEN' : 'RED',
  mismatchPct: parseFloat(mismatchPct.toFixed(3)),
  mismatchPx,
  totalPx,
  threshold,
  diffImage: args.diff!,
  engine: engineName,
  timestamp: new Date().toISOString(),
  images: {
    expected: args.expected!,
    actual: args.actual!,
  },
};

if (outputJson) {
  console.log(JSON.stringify(result));
} else {
  console.log('-'.repeat(50));
  console.log(`Engine:    ${result.engine}`);
  console.log(`Status:    ${result.status}`);
  console.log(`Mismatch:  ${mismatchPct.toFixed(3)}%  (${mismatchPx}px / ${totalPx}px)`);
  console.log(`Threshold: ${threshold}%`);
  console.log(`Diff img:  ${args.diff}`);
  if (ignoreRegions.length > 0) {
    console.log(`Ignored:   ${ignoreRegions.length} region(s)`);
  }
  console.log('-'.repeat(50));

  if (!isGreen) {
    console.log('→ RED: fix CSS/component, then re-run capture.ts + diff.ts.');
  } else {
    console.log('→ GREEN: actual matches baseline.');
  }
}

// Write JSON to file if requested
if (outputJsonPath) {
  const outDir = dirname(outputJsonPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outputJsonPath, JSON.stringify(result, null, 2));
  if (!outputJson) {
    console.log(`→ JSON result written to: ${outputJsonPath}`);
  }
}

process.exit(isGreen ? 0 : 1);
