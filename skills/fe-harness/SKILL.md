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

Two-loop feedback harness for frontend UI work:
**Interaction TDD** (behavior) then **Visual Verification** (appearance).

```
PHASE 0: Context & Spec ─→ PHASE 1: Classify ─→ PHASE 2: Interaction TDD ─→ PHASE 3: Visual Verify ─→ PHASE 4: Complete
                                    │                                              ▲
                                    └── style-only ────────────────────────────────┘
```

## Setup

Run once after installing the skill:

```bash
cd skills/fe-harness/scripts
npm run setup        # installs deps + downloads Chromium
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

---

## PHASE 0 — Context & Spec Generation

### Step 1. Gather Figma design

**1a. Design spec via Figma MCP:**

```
mcp__figma__get_design_context({ fileKey, nodeId })
→ design tokens, colors, spacing, component structure
→ inline screenshot (conversation reference only — CANNOT be saved to disk)
→ frame width × height (for viewport matching)
```

**1b. Expected image via Figma REST API:**

> Use `figma-export.ts` for disk images — MCP screenshots are conversation-only (see Gotchas).

```bash
export FIGMA_TOKEN=<TOKEN>   # or set in .env
npx tsx skills/fe-harness/scripts/figma-export.ts \
  --file-key <FILE_KEY> --node-ids <NODE_ID> \
  --out visual-qa/expected --scale 1
```

See [references/figma-reference.md](references/figma-reference.md) for nodeId lookup
and scale matching details.

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
| **style-only** | Color, spacing, font, layout changes. No new interactions. | Skip PHASE 2 → PHASE 3 |
| **interactive** | New component, form, modal, navigation, state changes. | PHASE 2 → PHASE 3 |
| **ambiguous** | Unclear whether interactions change. | Ask human (see below) |

**When ambiguous, ask:**
- "This task changes styles only, or are there interaction changes too?"
- "Do we need interaction specs for this?"
- "Does existing behavior stay the same?"

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

### Step 1. Write all Playwright tests (before implementation)

Write tests for **all** spec items at once in `e2e/<task>.spec.ts`. Tests MUST fail (RED).

- Base URL for component tasks: `/dev/preview?component=<Name>`
- One `test()` per interaction spec item
- Prefer role-based selectors (`getByRole`, `getByLabel`)

### Step 2. Handle API mocking

```
Does the component make API calls?
  │
  ├── No → proceed without mocking
  │
  └── Yes → detect project mocking infrastructure:
        │
        ├── MSW present (msw in package.json)
        │   → Use existing handlers or add new ones
        │   → In preview files: worker.use(http.get('*/endpoint', handler))
        │
        └── No MSW
            → Use page.route() inline in test files:
              await page.route('**/api/login', route =>
                route.fulfill({ status: 200, body: JSON.stringify({ token: '...' }) })
              );

If API endpoints or response shapes are unknown → ask human.
```

Mock data is stored in `e2e/mocks/` for reuse across tests.

### Step 3. Confirm RED

```bash
npx playwright test e2e/<task>.spec.ts
```

All tests must fail. If any pass unexpectedly, investigate.

### Step 4. Implement → GREEN

Implement the component/page. Run tests after each significant change.

**Exit condition — stall counter:**
```
After each test run:
  Did the number of passing tests increase?
    ├── Yes → continue (progress)
    └── No  → stall counter +1

Stall counter reaches 3 → stop and escalate to human:
  "N/M tests passing. Stuck on: [failing test names]. Need guidance."
```

---

## PHASE 3 — Visual Verification Loop

Entered after PHASE 2 GREEN (or directly for style-only tasks).

### Step 1. Start dev server if not running

```bash
npm run dev &
npx wait-on http://localhost:<PORT>
```

### Step 2. Capture screenshot

```bash
npx tsx skills/fe-harness/scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<task>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```

Width/height must match the Figma frame dimensions from PHASE 0.

### Step 3. Compare with Figma (Claude visual comparison)

> Figma vs browser → use Claude visual comparison, not diff.ts (see Gotchas).

Present both images to Claude for comparison:
1. The Figma expected image (`visual-qa/expected/<task>.png`)
2. The captured screenshot (`visual-qa/actual/<task>.png`)

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

## PHASE 4 — Completion & Harness Accumulation

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
npx tsx skills/fe-harness/scripts/diff.ts \
  --expected visual-qa/expected/<task>-baseline.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold 0.5
```

This catches unintended visual regressions (browser vs browser = reliable).

---

## Checklist

- [ ] Figma design gathered (MCP for spec, REST API for expected image)
- [ ] Interaction spec generated and confirmed by human
- [ ] Complexity classified (style-only / interactive / ambiguous → asked)
- [ ] `/dev/preview` route exists (component tasks)
- [ ] API mocking strategy determined (MSW / page.route / none)
- [ ] PHASE 2: All interaction tests written → RED confirmed → GREEN achieved
- [ ] PHASE 3: capture.ts screenshot → Claude comparison → visual GREEN
- [ ] PHASE 4: Baseline saved, artifacts committed

---

## CI Integration

See [references/ci-guide.md](references/ci-guide.md) for guidance on running
interaction tests and visual regression in CI pipelines.
