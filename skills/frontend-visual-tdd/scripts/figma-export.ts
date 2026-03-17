#!/usr/bin/env tsx
/**
 * figma-export.ts — Download Figma frame images via REST API
 *
 * LLMs cannot access raw binary data from Figma MCP inline images.
 * This script calls the Figma REST API directly to save images as files.
 *
 * Usage:
 *   npx tsx figma-export.ts --file-key <key> --node-ids <id,...> --token <token> --out <dir> [options]
 *
 * Options:
 *   --file-key   Figma file key (required)
 *   --node-ids   Comma-separated node IDs, e.g. "123:456,789:012" (required)
 *   --token      Figma Personal Access Token (required)
 *   --out        Output directory, e.g. visual-qa/expected (required)
 *   --scale      Image scale factor (default: 1)
 *   --format     png | jpg | svg | pdf (default: png)
 *
 * Exit codes:
 *   0 = success
 *   1 = error (invalid args, API failure, download failure)
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';

// --- Args ---

const { values } = parseArgs({
  options: {
    'file-key': { type: 'string' },
    'node-ids': { type: 'string' },
    token:      { type: 'string' },
    out:        { type: 'string' },
    scale:      { type: 'string', default: '1' },
    format:     { type: 'string', default: 'png' },
  },
  strict: false,
});

const args = values as Record<string, string | undefined>;

if (!args['file-key'] || !args['node-ids'] || !args.token || !args.out) {
  console.error('Usage: npx tsx figma-export.ts --file-key <key> --node-ids <id,...> --token <token> --out <dir>');
  process.exit(1);
}

const fileKey = args['file-key'];
const nodeIds = args['node-ids'].split(',').map((id) => id.trim());
const token   = args.token.trim();
const outDir  = args.out;
const scale   = args.scale ?? '1';
const format  = args.format ?? 'png';

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// --- Figma API ---

const idsParam = nodeIds.join(',');
const apiUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${idsParam}&format=${format}&scale=${scale}`;

console.log(`[figma] Requesting images for ${nodeIds.length} node(s)...`);

const res = await fetch(apiUrl, {
  headers: { 'X-FIGMA-TOKEN': token },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`[ERROR] Figma API returned ${res.status}: ${body}`);
  if (res.status === 403) {
    console.error('→ Check that your token is valid. Regenerate at https://www.figma.com/developers/api#access-tokens');
  }
  process.exit(1);
}

const data = (await res.json()) as { images: Record<string, string | null>; err: string | null };

if (data.err) {
  console.error(`[ERROR] Figma API error: ${data.err}`);
  process.exit(1);
}

// --- Download images ---

let downloaded = 0;

for (const nodeId of nodeIds) {
  const imageUrl = data.images[nodeId];

  if (!imageUrl) {
    console.error(`[WARN] No image URL for node ${nodeId} — skipping`);
    continue;
  }

  const safeName = nodeId.replace(/:/g, '-');
  const outPath  = join(outDir, `${safeName}.${format}`);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    console.error(`[ERROR] Failed to download image for node ${nodeId}: ${imgRes.status}`);
    continue;
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(outPath, buffer);
  console.log(`[figma] ${nodeId} → ${outPath}`);
  downloaded++;
}

console.log(`\n[figma] Done: ${downloaded}/${nodeIds.length} image(s) saved to ${outDir}`);

if (downloaded === 0) {
  console.error('[ERROR] No images were downloaded.');
  process.exit(1);
}
