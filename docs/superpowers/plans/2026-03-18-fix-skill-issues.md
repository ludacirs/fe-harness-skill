# fe-harness Skill Issue Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 reported issues in the fe-harness skill — 3 code fixes (capture.ts, figma-export.ts) and 4 documentation improvements (SKILL.md).

**Architecture:** Code fixes use minimal, targeted changes to existing scripts. SKILL.md changes add enforcement rules and guidance sections without restructuring the document. No new files created.

**Tech Stack:** TypeScript (Node.js ESM), Playwright, Figma REST API, Markdown

**Spec:** `docs/superpowers/specs/2026-03-18-fix-skill-issues-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `skills/fe-harness/scripts/capture.ts` | Modify | Fix dependency resolution + path resolution (Issues #1, #2) |
| `skills/fe-harness/scripts/figma-export.ts` | Modify | Add token validation (Issue #3) |
| `skills/fe-harness/SKILL.md` | Modify | Add enforcement rules + guidance (Issues #4, #5, #6, #7) |

---

### Task 1: Fix capture.ts dependency resolution (Issue #2)

**Files:**
- Modify: `skills/fe-harness/scripts/capture.ts:35-46`

- [ ] **Step 1: Fix playwright import to use createRequire resolution**

Replace the guard + bare import block (lines 35-46):

```typescript
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
```

With:

```typescript
// Resolve playwright from the script's own node_modules (not caller's cwd)
const require = createRequire(import.meta.url);
let playwrightPath: string;
try {
  playwrightPath = require.resolve('playwright');
} catch {
  const skillDir = new URL('../', import.meta.url).pathname;
  console.error('[ERROR] playwright is not installed.');
  console.error(`→ Run: cd ${skillDir}scripts && npm run setup`);
  process.exit(1);
}

const { chromium } = await import(playwrightPath);
```

- [ ] **Step 2: Verify the script parses without error**

Run:
```bash
npx tsx --eval "import('file:///PATH_TO/skills/fe-harness/scripts/capture.ts')" 2>&1 || true
```
Expected: should fail with "Usage: ..." (missing --url), NOT with "Cannot find module 'playwright'".

- [ ] **Step 3: Commit**

```bash
git add skills/fe-harness/scripts/capture.ts
git commit -m "fix: resolve playwright from script's own node_modules via createRequire"
```

---

### Task 2: Fix capture.ts path resolution for relative args (Issue #1)

**Files:**
- Modify: `skills/fe-harness/scripts/capture.ts:30-31, 122-127, 148-149, 159-160, 168-169, 203-204`

- [ ] **Step 1: Add resolve import and callerCwd helper**

After the existing imports (line 31: `import { dirname } from 'path';`), add `resolve`:

Change:
```typescript
import { dirname } from 'path';
```
To:
```typescript
import { dirname, resolve, isAbsolute } from 'path';
```

Then after the `createRequire` / playwright import block (before `// --- Types ---`), add:

```typescript
// Resolve file paths relative to the caller's working directory, not the script's location.
// ORIGINAL_CWD is an optional safety net for wrapper scripts that change cwd before invoking.
const callerCwd = process.env.ORIGINAL_CWD || process.cwd();
function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(callerCwd, p);
}
```

- [ ] **Step 2: Apply resolvePath to --out, --steps, --mock-routes**

Change line 123 (`const out = args.out;`):
```typescript
const out = resolvePath(args.out);
```

Change line 126 (`const stepsPath = args.steps;`):
```typescript
const stepsPath = args.steps ? resolvePath(args.steps) : undefined;
```

Change line 127 (`const mockRoutesPath = args['mock-routes'];`):
```typescript
const mockRoutesPath = args['mock-routes'] ? resolvePath(args['mock-routes']) : undefined;
```

- [ ] **Step 3: Verify the script still handles --help correctly**

Run:
```bash
npx tsx skills/fe-harness/scripts/capture.ts --help
```
Expected: Usage text printed, exit 0.

- [ ] **Step 4: Commit**

```bash
git add skills/fe-harness/scripts/capture.ts
git commit -m "fix: resolve relative --out/--steps/--mock-routes against caller's cwd"
```

---

### Task 3: Add FIGMA_TOKEN validation to figma-export.ts (Issue #3)

**Files:**
- Modify: `skills/fe-harness/scripts/figma-export.ts:91-93`

- [ ] **Step 1: Add token validation after format check, before mkdir**

Insert the following block between line 91 (`}` closing the `figd_` check) and line 93 (`if (!existsSync(outDir))...`):

```typescript
// --- Validate token against Figma API ---
console.log('[figma] Validating token...');
const meRes = await fetch('https://api.figma.com/v1/me', {
  headers: { 'X-FIGMA-TOKEN': token },
});

if (!meRes.ok) {
  if (meRes.status === 401 || meRes.status === 403) {
    console.error(`[ERROR] Token is invalid or expired (HTTP ${meRes.status}).`);
    console.error('→ Regenerate at https://www.figma.com/developers/api#access-tokens');
  } else {
    console.error(`[ERROR] Figma API returned ${meRes.status} during token validation.`);
    console.error('→ Figma may be temporarily unavailable. Try again in a few minutes.');
  }
  process.exit(1);
}
console.log('[figma] Token valid.');
```

- [ ] **Step 2: Verify the script still shows --help correctly**

Run:
```bash
npx tsx skills/fe-harness/scripts/figma-export.ts --help
```
Expected: Usage text printed, exit 0.

- [ ] **Step 3: Commit**

```bash
git add skills/fe-harness/scripts/figma-export.ts
git commit -m "fix: validate FIGMA_TOKEN via /v1/me before making image requests"
```

---

### Task 4: Add NEVER rule for diff.ts misuse in SKILL.md (Issue #4)

**Files:**
- Modify: `skills/fe-harness/SKILL.md:311-314`

- [ ] **Step 1: Strengthen the Figma comparison warning in PHASE 4 Step 3**

Current text (lines 311-314):
```markdown
### Step 3. Compare with Figma (Claude visual comparison — local files only)

> Figma vs browser → use Claude visual comparison, not diff.ts (see Gotchas).
> Do NOT call Figma MCP here. Use the downloaded file from PHASE 3.
```

Replace with:
```markdown
### Step 3. Compare with Figma (Claude visual comparison — local files only)

> **NEVER use `diff.ts` for Figma-vs-browser comparison.** Pixel-level diffing
> across different rendering engines (Figma vs Chromium) produces false positives
> due to font rendering, anti-aliasing, and sub-pixel differences. `diff.ts` is
> for browser-vs-browser regression ONLY (PHASE 5).
>
> **NEVER call Figma MCP here.** Use the downloaded file from PHASE 3.
```

- [ ] **Step 2: Commit**

```bash
git add skills/fe-harness/SKILL.md
git commit -m "docs: add NEVER rule for diff.ts misuse in Visual TDD phase"
```

---

### Task 5: Add TDD RED/GREEN hard gates in SKILL.md (Issue #5)

**Files:**
- Modify: `skills/fe-harness/SKILL.md:224-249`

- [ ] **Step 1: Add hard gate after Step 3 (RED confirmation)**

After the current Step 3 block (line 230: `All tests must fail. If any pass unexpectedly, investigate.`), insert:

```markdown

>>> HARD GATE: Do NOT proceed to implementation until ALL tests have been run and confirmed FAILING (RED). <<<

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests FAIL (RED confirmed)
- [ ] If tests cannot run (environment issue), fix the environment FIRST — do NOT skip to implementation
```

- [ ] **Step 2: Add hard gate after Step 4 (GREEN confirmation)**

Replace the current "Workflow A complete" block (lines 247-249):
```markdown
### Workflow A complete

All interaction tests GREEN. Proceed to **Workflow B**.
```

With:
```markdown
### Workflow A complete

>>> HARD GATE: Do NOT proceed to Workflow B until ALL interaction tests PASS. <<<

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests PASS (GREEN confirmed — 0 failures)
- [ ] If any test fails, fix implementation FIRST — do NOT skip to Visual TDD
```

- [ ] **Step 3: Commit**

```bash
git add skills/fe-harness/SKILL.md
git commit -m "docs: add hard gates for RED/GREEN confirmation in Interaction TDD"
```

---

### Task 6: Add capture target enumeration step in SKILL.md (Issue #6)

**Files:**
- Modify: `skills/fe-harness/SKILL.md:258-264, 389-395`

- [ ] **Step 1: Insert Step 0 at the start of PHASE 3**

Before the current Step 1 (line 262: `### Step 1. Download Figma expected images via REST API`), insert:

```markdown
### Step 0. Enumerate capture targets

Before downloading, list ALL visual states that need comparison. Use the Figma
nodes and design context gathered in PHASE 0 — do NOT make additional Figma MCP calls.

```
Enumerate:
  1. List every Figma node/frame from PHASE 0 (tables, modals, states, variants)
  2. For each node, define capture scenarios:
     - Default state
     - Interactive states (hover, focus, open, expanded, etc.)
     - Data variants (empty, loaded, error, loading)
  3. Present the full list to the human for confirmation
  4. Track as checklist — ALL items must be captured before Visual TDD is complete
```

>>> HARD GATE: Do NOT download images until the capture target list is confirmed by the human. <<<

```

- [ ] **Step 2: Update the Workflow B checklist at the bottom**

Replace the current Workflow B checklist (lines 389-395):
```markdown
### Workflow B — Visual TDD
- [ ] Expected images downloaded via figma-export.ts (REST API, NOT MCP)
- [ ] Download verified (files exist on disk)
- [ ] capture.ts screenshot taken
- [ ] Claude visual comparison (local files only, no MCP)
- [ ] Visual GREEN achieved
- [ ] Baseline saved, artifacts committed
```

With:
```markdown
### Workflow B — Visual TDD
- [ ] Capture target list enumerated (all nodes, all states)
- [ ] Capture target list confirmed by human
- [ ] Expected images downloaded via figma-export.ts (REST API, NOT MCP)
- [ ] Download verified (files exist on disk)
- [ ] capture.ts screenshot taken for ALL targets
- [ ] Claude visual comparison for ALL targets (local files only, no MCP)
- [ ] Visual GREEN achieved for ALL targets
- [ ] Baseline saved, artifacts committed
```

- [ ] **Step 3: Commit**

```bash
git add skills/fe-harness/SKILL.md
git commit -m "docs: add capture target enumeration step to Visual TDD"
```

---

### Task 7: Add API mock troubleshooting guide in SKILL.md (Issue #7)

**Files:**
- Modify: `skills/fe-harness/SKILL.md:200-222`

- [ ] **Step 1: Add troubleshooting subsection after Step 2's mock decision tree**

After line 222 (`Mock data is stored in \`e2e/mocks/\` for reuse across tests.`), insert:

```markdown

#### API mock troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `page.route('**/api/...')` not intercepting | API host is an absolute external URL (e.g., `http://172.168.x.x/api/...`). Glob patterns like `**/api` only match relative paths. | Use the full URL pattern: `page.route('http://172.168.x.x/api/users', ...)` or `page.route('**/172.168.x.x/**', ...)` |
| Mock works in test but not in capture.ts | capture.ts uses `--mock-routes` JSON, not Playwright test fixtures | Pass mock routes via `--mock-routes mock-routes.json`. See `references/mock-routes-example.json` |
| Component renders with real data instead of mock | MSW handlers not registered in preview file, or dev server not using MSW | Check that preview file imports and activates MSW worker; or use `page.route()` as fallback |
| Mock returns but component shows loading spinner | Response shape doesn't match what component expects | Log `mock.response` and compare with component's API type definition |

**When `page.route()` doesn't work at all:**
1. Check if the project uses a dev preview page (`/dev/preview?component=...`) with built-in MSW handlers — prefer that over `page.route()`
2. Check `VITE_API_HOST` / `NEXT_PUBLIC_API_URL` env vars — if they point to an external host, use the full URL in `page.route()`
3. As last resort, create a test-specific environment config that points API calls to a localhost mock server
```

- [ ] **Step 2: Commit**

```bash
git add skills/fe-harness/SKILL.md
git commit -m "docs: add API mock troubleshooting guide to Interaction TDD"
```

---

### Task 8: Update SKILL.md script invocation commands (Issue #1)

**Files:**
- Modify: `skills/fe-harness/SKILL.md:266-271, 301-307, 366-372`

- [ ] **Step 1: Update capture.ts invocation in PHASE 4 Step 2**

The current command (lines 301-307):
```markdown
```bash
npx tsx skills/fe-harness/scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<task>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```
```

Replace with:
```markdown
```bash
npx tsx ~/.claude/skills/fe-harness/scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<task>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```

> Scripts resolve relative paths (like `--out visual-qa/actual/...`) against your
> current working directory. No `cd` or `NODE_PATH` needed.
```

- [ ] **Step 2: Update diff.ts invocation in PHASE 5**

The current command (lines 366-372):
```markdown
```bash
npx tsx skills/fe-harness/scripts/diff.ts \
  --expected visual-qa/expected/<task>-baseline.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold 0.5
```
```

Replace `skills/fe-harness/scripts/diff.ts` with `~/.claude/skills/fe-harness/scripts/diff.ts`.

- [ ] **Step 3: Update figma-export.ts invocation in PHASE 3 Step 1**

The current command (lines 266-271):
```markdown
```bash
export FIGMA_TOKEN=<TOKEN>   # or set in .env
npx tsx skills/fe-harness/scripts/figma-export.ts \
  --file-key <FILE_KEY> --node-ids <NODE_ID> \
  --out visual-qa/expected --scale 1
```
```

Replace `skills/fe-harness/scripts/figma-export.ts` with `~/.claude/skills/fe-harness/scripts/figma-export.ts`.

- [ ] **Step 4: Commit**

```bash
git add skills/fe-harness/SKILL.md
git commit -m "docs: update script invocation paths — use ~/.claude absolute path, remove cd/NODE_PATH"
```

---

## Execution Order

Tasks 1-3 are code changes (independent of each other).
Tasks 4-8 are SKILL.md documentation changes (can be done in any order but applied sequentially to avoid merge conflicts).

Recommended order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**
