---
name: fe-harness
description: >
  Use this skill when implementing any frontend UI work — building components,
  implementing pages, changing styles, or creating interaction flows. Activate
  when working from a Figma design or when the user asks to "implement this
  design", "build this component", "match this mockup", or any frontend task
  needing quality verification, even if they don't mention testing or QA.
  Runs interaction TDD with Playwright, then visual verification against Figma.
compatibility: Requires Node.js 18+, Playwright, Figma Personal Access Token (figd_*)
allowed-tools: Bash(npx:*) Bash(npm:*) Read Write Edit Glob Grep
---

# Frontend Harness

Two-loop feedback harness for frontend UI work.
Split into two **independent workflows** that run sequentially:

1. **Workflow A — Interaction TDD**: Figma MCP for design context → spec → e2e tests → implement (behavior)
2. **Workflow B — Visual TDD**: Download Figma images → capture screenshot → compare → iterate (appearance)

```
┌─ WORKFLOW A: Interaction TDD ─────────────────────────────────────────────┐
│ PHASE 0: MCP Context & Spec → PHASE 1: Classify → PHASE 2: Interaction TDD │
└───────────────────────────────────────────────────────────────────────────┘
                          ↓ (all interaction tests GREEN)
┌─ WORKFLOW B: Visual TDD ──────────────────────────────────────────────────┐
│ PHASE 3: Download Expected Images → PHASE 4: Visual Verify Loop           │
└───────────────────────────────────────────────────────────────────────────┘
                          ↓
                   PHASE 5: Complete
```

> **style-only tasks**: Skip Workflow A → go directly to Workflow B.

## Setup

Run once per project to install required dependencies:

```bash
npm install -D playwright pixelmatch pngjs tsx
npx playwright install chromium --with-deps
```

---

## Gotchas

- **Figma MCP screenshots ≠ files.** `get_design_context` returns an inline
  image for conversation reference only — it cannot be saved to disk. Always
  use `figma-export.ts` (REST API) for images that need to exist as files.
- **No pixel-diff for Figma vs browser.** Font rendering and anti-aliasing
  make pixel comparison unreliable across rendering engines. Use Claude visual
  comparison for Figma-to-browser. `diff.ts` is for browser-to-browser
  regression only.
- **Figma nodeId format.** URL `node-id=123-456` → API `123:456` (dash → colon).
- **Stall counter = 3.** If passing test count doesn't increase for 3
  consecutive runs, stop and escalate to the human.
- **Workflow B does NOT use Figma MCP.** Image download uses REST API only
  (`figma-export.ts`). Visual comparison uses Claude vision on local files only.

---

# WORKFLOW A — Interaction TDD

> Uses Figma MCP for design context. Does NOT download images.

## PHASE 0 — Context & Spec Generation

### Step 1. Gather design context via Figma MCP

```
mcp__figma__get_design_context({ fileKey, nodeId })
→ design tokens, colors, spacing, component structure
→ inline screenshot (conversation reference only — CANNOT be saved to disk)
→ frame width × height (save these for Workflow B viewport matching)
```

> **No image download in this phase.** Images are downloaded in Workflow B (PHASE 3).
> Save the `fileKey`, `nodeId`, and frame dimensions for later use.

### Step 2. Generate interaction spec

Synthesize Figma design + task description into a structured spec:

```markdown
## Interaction Spec

### Component: <Name>

**Initial state:**
- [describe what user sees on load]

**Interactions:**
1. [action] → [expected result]
2. [action] → [expected result]

**Edge cases:**
- [error state, empty state, loading state, etc.]

**API calls:**
- [endpoint] → [mock response shape]

**Visual reference (for Workflow B):**
- fileKey: <FILE_KEY>
- nodeId: <NODE_ID>
- viewport: <W> × <H>
```

See [references/spec-template.md](references/spec-template.md) for full template.

### Step 3. Clarify unknowns

Ask the human when:
- Figma has no state variants (hover, loading, error) but they're expected
- Buttons exist but post-click behavior is unclear
- API calls are expected but success/failure handling isn't in the design
- Conditional rendering exists but conditions are unclear

### Step 4. Human confirms spec

Present the generated spec. Human confirms or modifies. Spec is finalized.

---

## PHASE 1 — Complexity Classification

Classify **before** any implementation.

| Complexity | Criteria | Path |
|------------|----------|------|
| **style-only** | Color, spacing, font, layout changes. No new interactions. | Skip to Workflow B (PHASE 3) |
| **interactive** | New component, form, modal, navigation, state changes. | PHASE 2 → Workflow B |
| **ambiguous** | Unclear whether interactions change. | Ask human (see below) |

**When ambiguous, ask:**
- "This task changes styles only, or are there interaction changes too?"
- "Do we need interaction specs for this?"
- "Does existing behavior stay the same?"

### HARD GATE — No implementation without RED tests

If classified as **interactive**, you MUST complete PHASE 2 before writing
ANY implementation code (components, pages, flows, styles, routes, etc.).

The ONLY classification that skips PHASE 2 is **style-only**.

Verify before proceeding to implementation:
- [ ] `e2e/<task>.spec.ts` exists
- [ ] `npx playwright test e2e/<task>.spec.ts` has been run
- [ ] All tests fail (RED confirmed)

If any item is unmet, STOP and complete PHASE 2 first.

### Invalid reasons to skip PHASE 2

These are NOT valid reasons to skip Interaction TDD:
- "The task is a full page, not a component." → Test at the page route URL.
- "There are too many interactions." → Write tests for all of them.
- "It will take too long." → Interaction TDD is a required process, not optional.
- "No `/dev/preview` route is needed." → Use the actual page/flow route when the task is not a component.

---

## PHASE 2 — Interaction TDD Loop

> Skipped for style-only tasks.

### Prerequisites

**Playwright Test setup** — if the project doesn't have it, set it up:
- `playwright.config.ts` at project root
- `e2e/` directory for test files
- This setup is **permanent** — it stays in the project as harness infrastructure.

**`/dev/preview` route** — for component-type tasks:
- URL pattern: `/dev/preview?component=<ComponentName>`
- Place outside auth layout groups (no login required)
- Add dev-only guard (`import.meta.env.DEV` or equivalent)
- Separate preview wrapper per component (e.g., `<Name>.preview.tsx`)
- For components with API calls: register MSW handlers or use `page.route()`
  in the preview file

### Test base URL by task type

| Task type | Base URL |
|-----------|----------|
| Component | `/dev/preview?component=<ComponentName>` |
| Page | Actual page route (e.g. `/users`) |
| Flow | Starting page route of the flow |

### Step 1. Write all Playwright tests (before implementation)

Write tests for **all** spec items at once in `e2e/<task>.spec.ts`. Tests MUST fail (RED).

- Use the correct base URL from the table above
- One `test()` per interaction spec item
- Prefer role-based selectors (`getByRole`, `getByLabel`)

### Step 2. Handle API mocking

```
Does the task make API calls?
  │
  ├── No → proceed without mocking
  │
  └── Yes → detect project mocking infrastructure:
        │
        ├── MSW present (msw in package.json)
        │   → Use existing handlers or add new ones
        │   → For component preview routes, configure handlers in the preview file if needed
        │
        └── No MSW
            → Use page.route() inline in test files:
              await page.route('**/api/login', route =>
                route.fulfill({ status: 200, body: JSON.stringify({ token: '...' }) })
              );

If API endpoints or response shapes are unknown → ask human.
```

Mock data is stored in `e2e/mocks/` for reuse across tests.

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

### Step 3. Confirm RED

```bash
npx playwright test e2e/<task>.spec.ts
```

All tests must fail. If any pass unexpectedly, investigate.

>>> HARD GATE: Do NOT proceed to implementation until ALL tests have been run and confirmed FAILING (RED). <<<

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests FAIL (RED confirmed)
- [ ] If tests cannot run (environment issue), fix the environment FIRST — do NOT skip to implementation

### Step 4. Implement → GREEN

Implement the component/page/flow. Run tests after each significant change.

**Exit condition — stall counter:**
```
After each test run:
  Did the number of passing tests increase?
    ├── Yes → continue (progress)
    └── No  → stall counter +1

Stall counter reaches 3 → stop and escalate to human:
  "N/M tests passing. Stuck on: [failing test names]. Need guidance."
```

### Workflow A complete

>>> HARD GATE: Do NOT proceed to Workflow B until ALL interaction tests PASS. <<<

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests PASS (GREEN confirmed — 0 failures)
- [ ] If any test fails, fix implementation FIRST — do NOT skip to Visual TDD

---

# WORKFLOW B — Visual TDD

> Does NOT use Figma MCP. Uses REST API for image download and Claude vision for comparison.
> All visual references are local files only.

## PHASE 3 — Download Expected Images

> **This is the FIRST step of Workflow B.** Images MUST be downloaded before any visual comparison.

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

### Step 1. Download Figma expected images via REST API

Use the `fileKey` and `nodeId` saved from PHASE 0 (or from the Figma URL if style-only).

```bash
export FIGMA_TOKEN=<TOKEN>   # or set in .env
npx tsx ~/.claude/skills/fe-harness/scripts/figma-export.ts \
  --file-key <FILE_KEY> --node-ids <NODE_ID> \
  --out visual-qa/expected --scale 1
```

See [references/figma-reference.md](references/figma-reference.md) for nodeId lookup
and scale matching details.

### Step 2. Verify download

Confirm the expected image exists on disk:
```bash
ls -la visual-qa/expected/
```

> **Do NOT proceed to PHASE 4 until the expected image file exists.**
> If download fails, check FIGMA_TOKEN and nodeId format (must use colon: `123:456`).

---

## PHASE 4 — Visual Verification Loop

> No Figma MCP calls in this phase. All comparison uses local files + Claude vision.

### Step 1. Start dev server if not running

```bash
npm run dev &
npx wait-on http://localhost:<PORT>
```

### Step 2. Capture screenshot

```bash
npx tsx ~/.claude/skills/fe-harness/scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<task>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```

> Scripts resolve relative paths (like `--out visual-qa/actual/...`) against your
> current working directory. No `cd` or `NODE_PATH` needed.

Width/height must match the Figma frame dimensions saved from PHASE 0.

### Step 3. Compare with Figma (Claude visual comparison — local files only)

> **NEVER use `diff.ts` for Figma-vs-browser comparison.** Pixel-level diffing
> across different rendering engines (Figma vs Chromium) produces false positives
> due to font rendering, anti-aliasing, and sub-pixel differences. `diff.ts` is
> for browser-vs-browser regression ONLY (PHASE 5).
>
> **NEVER call Figma MCP here.** Use the downloaded file from PHASE 3.

Present both **local** images to Claude for comparison:
1. `visual-qa/expected/<task>.png` (downloaded from Figma REST API in PHASE 3)
2. `visual-qa/actual/<task>.png` (captured screenshot)

Claude judges: layout, spacing, colors, typography, overall fidelity.

### Step 4. Iterate

If Claude identifies differences:
- Fix CSS/styles
- Wait for hot reload
- Re-run capture.ts (Step 2)
- Re-compare (Step 3)

**Exit condition:** same stall counter as PHASE 2 (3 stalls → escalate).

### Step 5. Save baseline

When visual verification passes:
- The final actual screenshot becomes the **regression baseline**
- Copy to `visual-qa/expected/<task>-baseline.png`
- Future changes use `diff.ts` (pixelmatch) against this baseline
  (browser vs browser comparison IS reliable)

---

## PHASE 5 — Completion & Harness Accumulation

### Artifacts that stay in the project

```
e2e/<task>.spec.ts              ← interaction tests (cumulative)
e2e/mocks/                      ← API mock data (reusable)
dev/preview/<Component>.tsx     ← preview routes (cumulative)
visual-qa/expected/             ← baseline screenshots (commit)
visual-qa/config.json           ← per-task thresholds (commit)
playwright.config.ts            ← created once, permanent
```

### .gitignore additions

```
visual-qa/actual/
visual-qa/diff/
```

### Regression: diff.ts for future changes

After baseline is established, future tasks can run:

```bash
npx tsx ~/.claude/skills/fe-harness/scripts/diff.ts \
  --expected visual-qa/expected/<task>-baseline.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold 0.5
```

This catches unintended visual regressions (browser vs browser = reliable).

---

## Checklist

### Workflow A — Interaction TDD
- [ ] Figma MCP design context gathered (tokens, structure, dimensions)
- [ ] fileKey, nodeId, viewport dimensions saved for Workflow B
- [ ] Interaction spec generated and confirmed by human
- [ ] Complexity classified (style-only / interactive / ambiguous → asked)
- [ ] `/dev/preview` route exists (component tasks)
- [ ] API mocking strategy determined (MSW / page.route / none)
- [ ] All interaction tests written → RED confirmed → GREEN achieved

### Workflow B — Visual TDD
- [ ] Capture target list enumerated (all nodes, all states)
- [ ] Capture target list confirmed by human
- [ ] Expected images downloaded via figma-export.ts (REST API, NOT MCP)
- [ ] Download verified (files exist on disk)
- [ ] capture.ts screenshot taken for ALL targets
- [ ] Claude visual comparison for ALL targets (local files only, no MCP)
- [ ] Visual GREEN achieved for ALL targets
- [ ] Baseline saved, artifacts committed

---

## CI Integration

See [references/ci-guide.md](references/ci-guide.md) for guidance on running
interaction tests and visual regression in CI pipelines.
