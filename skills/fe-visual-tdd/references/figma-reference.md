# Figma Reference — MCP (spec) + REST API (image)

Two tools serve different purposes in PHASE 0. Do NOT mix them.

| Purpose | Tool | Output |
|---------|------|--------|
| Design spec (tokens, colors, spacing, component structure) | Figma MCP `get_design_context` | Inline data + screenshot (conversation only) |
| Expected image (pixel-accurate PNG for diff) | Figma REST API `figma-export.ts` | File on disk |

> **IMPORTANT:** Do NOT use MCP tools to download expected images.
> MCP inline screenshots are rendered in the conversation but **cannot be saved
> as files**. Always use `figma-export.ts` for images that need to exist on disk.

---

## Step A — Design spec via Figma MCP

Use `get_design_context` to gather design tokens, colors, fonts, spacing, and
component structure. The inline screenshot is for visual reference only.

```
mcp__figma__get_design_context({ fileKey, nodeId })
```

### Finding the nodeId

From a Figma URL:
```
https://www.figma.com/design/<FILE_KEY>/...?node-id=123-456
```
- `node-id=123-456` → API nodeId: `123:456`
- `node-id=123%3A456` → API nodeId: `123:456`

### Matching viewport dimensions

Use MCP to check the frame's bounding box, then pass those values as
`--width`/`--height` to `capture.ts`:

```
mcp__figma__get_design_context({ fileKey, nodeId })
→ absoluteBoundingBox: { width, height }
```

---

## Step B — Expected image via Figma REST API

Use `figma-export.ts` to download a pixel-accurate PNG:

```bash
export FIGMA_TOKEN=<TOKEN>   # or set in .env
npx tsx skills/fe-harness/scripts/figma-export.ts \
  --file-key <FILE_KEY> \
  --node-ids <NODE_ID>  \
  --out visual-qa/expected \
  --scale 1
```

### Options

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--file-key` | yes | — | Figma file key |
| `--node-ids` | yes | — | Comma-separated node IDs (e.g. `123:456,789:012`) |
| `--out` | yes | — | Output directory |
| `--scale` | no | `1` | Image scale (match with `capture.ts --device-scale-factor`) |
| `--format` | no | `png` | `png` / `jpg` / `svg` / `pdf` |
| `--token` | no | — | Fallback if `FIGMA_TOKEN` env var not set |

### Scale matching

Expected and actual images must have the same pixel dimensions:
- `--scale 1` (default) matches Playwright's default `deviceScaleFactor: 1`
- For 2x: use both `figma-export.ts --scale 2` and `capture.ts --device-scale-factor 2`

---

## Visual Test List — Build Procedure

Before downloading expected images, build a Visual Test List from Phase 0's
Figma nodes. Every nodeId from Phase 0 MUST appear as at least one test item.
Do NOT make additional Figma MCP calls — use the data already gathered.

**Rule: nodeId count = minimum test count.** If Phase 0 saved 3 nodeIds, the
Visual Test List must have at least 3 items (one per nodeId).

### Steps

1. For EACH nodeId from Phase 0, create one test entry:
   ```
   VT-1: <nodeId label> (nodeId: <X:Y>) → <figma-export filename>.png
   VT-2: <nodeId label> (nodeId: <X:Y>) → <figma-export filename>.png
   ```
2. For nodes with interactive states (hover, open, expanded, etc.),
   add additional entries with the SAME nodeId but different capture conditions:
   ```
   VT-N: <label> — <state> (nodeId: <X:Y>) → <filename>.png
   ```
3. Verify: every nodeId from Phase 0 has at least one VT entry.

### Output format (present this exactly)

```
Visual Test List (N items from M Figma nodes):
  VT-1: [label] (nodeId: [X:Y], viewport: [WxH]) → expected/[name].png
  VT-2: [label] (nodeId: [X:Y], viewport: [WxH]) → expected/[name].png
  ...
```
