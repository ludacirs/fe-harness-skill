---
name: fe-harness
description: >
  Use this skill when implementing any frontend UI work — building components,
  implementing pages, changing styles, or creating interaction flows. Activate
  when working from a Figma design or when the user asks to "implement this
  design", "build this component", "match this mockup", or any frontend task
  needing quality verification, even if they don't mention testing or QA.
  Runs interaction TDD with Playwright, then visual verification against Figma.
license: MIT
compatibility: Requires Node.js 18+, Playwright, Figma Personal Access Token (figd_*)
allowed-tools: Bash(npx:*) Bash(npm:*) Read Write Edit Glob Grep
metadata:
  author: ludacirs
  version: "1.0"
---

# Frontend Harness

Two-loop feedback harness for frontend UI work.
Split into two **independent workflows** that run sequentially:

1. **Workflow A — Interaction TDD**: Figma MCP for design context → spec → e2e tests → implement (behavior)
2. **Workflow B — Visual TDD**: Download Figma images → capture screenshot → compare → iterate (appearance)

## ABSOLUTE RULES — Read before anything else

These rules override ALL other instructions. Violating any of them is a critical failure.

1. **NEVER write implementation code before Phase 3 (RED) is confirmed.**
   - No component files. No page files. No style files. No route files. No layout files.
   - The ONLY code you may write before RED confirmation is **test code** (`.spec.ts`)
     and **test infrastructure** (`/dev/preview` wrapper for component tasks).
   - If you find yourself creating implementation `.tsx`, `.vue`, `.svelte`, or style files
     before Phase 3 is complete, you have violated this rule. STOP and delete it.

2. **Each phase ends with STOP.** You must present results to the user and
   receive explicit confirmation before moving to the next phase. Do NOT
   silently advance phases.

3. **One phase = one job.** Do NOT combine work from multiple phases into
   a single step. Phase 2 writes tests. Phase 3 runs them. Phase 4 implements.
   These are three separate actions with two confirmation gates between them.

```
┌─ WORKFLOW A: Interaction TDD ──────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Context │STOP│ Phase 1: Classify │STOP│ Phase 2: Tests │STOP│ Phase 3: RED │STOP│ Phase 4: Impl │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                          ↓ AUTO (all interaction tests GREEN → start Workflow B)
┌─ WORKFLOW B: Visual TDD ──────────────────────────────────────────────┐
│ Phase 5: Download Images │STOP│ Phase 6: Visual Verify │STOP│          │
└───────────────────────────────────────────────────────────────────────┘
                          ↓
                   Phase 7: Complete
```

**Quick Reference:**
| Phase | Job | Gate |
|-------|-----|------|
| 0 | Context & Spec | STOP — user confirms spec |
| 1 | Classify | STOP — user confirms classification |
| 2 | Write tests only | STOP — user confirms before running |
| 3 | Run tests, confirm RED | STOP — user confirms before implementing |
| 4 | Implement to GREEN | Report GREEN → auto-start Workflow B |
| 5 | Download expected images | STOP — user confirms capture targets |
| 6 | Visual verify loop | STOP — user confirms visual match |
| 7 | Complete | — |

> **style-only tasks**: Skip Workflow A → go directly to Workflow B (Phase 5).

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
- **Preview ≠ Production.** Duplicating markup means visual TDD verifies the copy, not the real page. See [references/preview-guide.md](references/preview-guide.md).

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

> **No image download in this phase.** Images are downloaded in Workflow B (Phase 5).
> Save the `fileKey`, `nodeId`, and frame dimensions for later use.

### Step 2. Generate interaction spec

Synthesize Figma design + task description into a structured spec.
Follow the template in [references/spec-template.md](references/spec-template.md).
Must include: initial state, interactions, edge cases, API calls, and visual reference (fileKey, nodeId, viewport).

### Step 3. Clarify unknowns

Ask the human when:
- Figma has no state variants (hover, loading, error) but they're expected
- Buttons exist but post-click behavior is unclear
- API calls are expected but success/failure handling isn't in the design
- Conditional rendering exists but conditions are unclear

### Step 4. Human confirms spec

Present the generated spec. Human confirms or modifies. Spec is finalized.

### >>> STOP — Present spec to user and wait <<<

Tell the user:
> "Phase 0 complete. Here is the interaction spec: [spec]. Confirm or modify?"

**Do NOT proceed to Phase 1 until the user confirms the spec.**

---

## PHASE 1 — Complexity Classification

Classify **before** any implementation.

| Complexity | Criteria | Path |
|------------|----------|------|
| **style-only** | Color, spacing, font, layout changes. No new interactions. | Skip to Workflow B (Phase 5) |
| **interactive** | New component, form, modal, navigation, state changes. | Phase 2 → 3 → 4 → Workflow B |
| **ambiguous** | Unclear whether interactions change. | Ask human (see below) |

**When ambiguous, ask:**
- "This task changes styles only, or are there interaction changes too?"
- "Do we need interaction specs for this?"
- "Does existing behavior stay the same?"

### HARD GATE — No implementation without RED tests

If classified as **interactive**, you MUST complete Phase 2 (write tests) AND
Phase 3 (confirm RED) before writing ANY implementation code.

The ONLY classification that skips to Workflow B is **style-only** (→ Phase 5).

### Invalid reasons to skip Phases 2–3

These are NOT valid reasons to skip Interaction TDD:
- "The task is a full page, not a component." → Test at the page route URL.
- "There are too many interactions." → Write tests for all of them.
- "It will take too long." → Interaction TDD is a required process, not optional.
- "No `/dev/preview` route is needed." → Use the actual page/flow route when the task is not a component.
- "I'll write tests and implementation together." → NO. Phase 2 = tests only. Phase 4 = implementation only.

### >>> STOP — Present classification to user and wait <<<

Tell the user:
> "Phase 1 complete. I classified this as [style-only/interactive]. Path: [Phase 2 or Phase 5]. Confirm?"

**Do NOT proceed until the user confirms the classification.**

---

## PHASE 2 — Write All Tests

> Skipped for style-only tasks.
>
> **This phase writes test code ONLY. No implementation code of any kind.**

### Prerequisites

Set up if not present: `playwright.config.ts` at root, `e2e/` directory.
For component tasks, create a `/dev/preview?component=<Name>` route (dev-only guard, outside auth layout).
See [references/test-setup-guide.md](references/test-setup-guide.md) for full setup details.

**CRITICAL:** Preview must import real production components — never copy-paste markup.
See [references/preview-guide.md](references/preview-guide.md) for construction rules,
file-based router handling, and monorepo setup.

### Test base URL by task type

| Task type | Base URL |
|-----------|----------|
| Component | `/dev/preview?component=<ComponentName>` |
| Page | Actual page route (e.g. `/users`) |
| Flow | Starting page route of the flow |

### Step 1. Write all Playwright tests

Write tests for **all** spec items at once in `e2e/<task>.spec.ts`.

- Use the correct base URL from the table above
- One `test()` per interaction spec item
- Prefer role-based selectors (`getByRole`, `getByLabel`)

### Step 2. Handle API mocking

If the task makes API calls: use MSW (if present in package.json) or `page.route()` inline.
Mock data goes in `e2e/mocks/`. If endpoints or response shapes are unknown → ask human.
See [references/mock-troubleshooting.md](references/mock-troubleshooting.md) for decision tree and common fixes.

### Phase 2 output

The ONLY files created in this phase are:
- `e2e/<task>.spec.ts` (test file)
- `e2e/mocks/*.json` (mock data, if needed)
- `dev/preview/<Component>.preview.tsx` (test infrastructure, only for component tasks)

**If you created any implementation file (component, page, style, route, layout), you have violated the rules. Delete it now.**

### >>> STOP — Present to user and wait <<<

Tell the user:
> "Phase 2 complete. I wrote N tests in `e2e/<task>.spec.ts`. Ready to run them and confirm RED?"

**Do NOT run the tests yet. Do NOT proceed to Phase 3 until the user confirms.**

---

## PHASE 3 — Confirm RED

> **This phase ONLY runs tests and confirms they fail. No implementation code.**

### Step 1. Run tests

```bash
npx playwright test e2e/<task>.spec.ts
```

### Step 2. Verify RED

All tests must fail. If any pass unexpectedly, investigate — something is wrong.

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests FAIL (RED confirmed)
- [ ] If tests cannot run (environment issue), fix the environment FIRST

### >>> STOP — Present to user and wait <<<

Tell the user:
> "Phase 3 complete. All N tests are RED (failing as expected). Ready to start implementation?"

**Do NOT write any implementation code until the user confirms.**
**Do NOT combine this with Phase 4. Wait.**

---

## PHASE 4 — Implement to GREEN

> **NOW you may write implementation code.** Only after Phase 3 RED is confirmed.

### Step 1. Implement

Implement the component/page/flow. Run tests after each significant change.

```bash
npx playwright test e2e/<task>.spec.ts
```

### Step 2. Track progress — stall counter

```
After each test run:
  Did the number of passing tests increase?
    ├── Yes → continue (progress)
    └── No  → stall counter +1

Stall counter reaches 3 → stop and escalate to human:
  "N/M tests passing. Stuck on: [failing test names]. Need guidance."
```

### Step 3. Confirm GREEN

- [ ] `npx playwright test e2e/<task>.spec.ts` executed
- [ ] All tests PASS (GREEN confirmed — 0 failures)
- [ ] If any test fails, fix implementation FIRST

### >>> STOP — Report GREEN, then auto-start Workflow B <<<

Tell the user:
> "Phase 4 complete — Workflow A (Interaction TDD) is done. All N tests GREEN.
> Moving to Workflow B (Visual TDD)."

**After reporting GREEN, immediately proceed to Phase 5 (Workflow B). Do NOT wait for user confirmation to start Workflow B — the transition is automatic.**

---

# WORKFLOW B — Visual TDD

> Does NOT use Figma MCP. Uses REST API for image download and Claude vision for comparison.
> All visual references are local files only.

## PHASE 5 — Download Expected Images

> **This is the FIRST step of Workflow B.** Images MUST be downloaded before any visual comparison.

### Step 1. Enumerate capture targets — Visual Test List

Build a **Visual Test List** from Phase 0's Figma nodes (≥ 1 VT item per nodeId).
See [references/figma-reference.md](references/figma-reference.md) §Visual Test List
for the build procedure and output format.

### >>> STOP — Present Visual Test List to user and wait <<<

Tell the user:
> "Phase 5: Visual Test List — I identified N visual tests from M Figma nodes:
> [Visual Test List]
> Confirm before I download?"

**Do NOT download images until the user confirms the Visual Test List.**

### Step 2. Download Figma expected images for ALL Visual Test items

Use `figma-export.ts` with ALL nodeIds from the Visual Test List.
Pass them comma-separated in a single call (the script batches the API request).

```bash
export FIGMA_TOKEN=<TOKEN>   # or set in .env
npx tsx scripts/figma-export.ts \
  --file-key <FILE_KEY> --node-ids <NODE_ID_1>,<NODE_ID_2>,... \
  --out visual-qa/expected --scale 1
```

See [references/figma-reference.md](references/figma-reference.md) for nodeId lookup
and scale matching details.

### Step 3. Verify download — ALL items

Confirm expected images exist for EVERY Visual Test item (`ls -la visual-qa/expected/`).
Cross-check each VT item: ✅ exists / ❌ missing. Do NOT proceed to Phase 6 until ALL exist.
If any download fails, check FIGMA_TOKEN and nodeId format (colon: `123:456`).

---

## PHASE 6 — Visual Verification Loop

> No Figma MCP calls in this phase. All comparison uses local files + Claude vision.

### Step 1. Start dev server if not running

```bash
npm run dev &
npx wait-on http://localhost:<PORT>
```

### Step 2–4. For EACH Visual Test item — capture, compare, iterate

**You MUST repeat Steps 2–4 for EVERY item in the Visual Test List from Phase 5.**
Do NOT move to the STOP gate until ALL items have been verified.

Track progress using the VT numbering from Phase 5:
```
Visual Test Progress:
  VT-1: [label] — ⬜ pending
  VT-2: [label] — ⬜ pending
  ...
```
Update after each item completes: ⬜ → ✅ PASS or ❌ FAIL (stall).
**ALL items must reach ✅ before proceeding to Step 5.**

**For each target:**

#### Step 2. Capture screenshot

Each target may require different **browser state** (e.g., toggle ON vs OFF,
modal open vs closed). Set up the correct state before capturing (navigate, trigger interaction, then capture):

```bash
npx tsx scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<target-name>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```

> Scripts resolve relative paths (like `--out visual-qa/actual/...`) against your
> current working directory. No `cd` or `NODE_PATH` needed.

Width/height must match the Figma frame dimensions saved from Phase 0.

#### Step 3. Compare with Figma (Claude visual comparison — local files only)

> **NEVER use `diff.ts` here** (see Gotchas). **NEVER call Figma MCP here.**

Present both **local** images to Claude for comparison:
1. `visual-qa/expected/<target-name>.png` (from Phase 5)
2. `visual-qa/actual/<target-name>.png` (captured screenshot)

Claude judges: layout, spacing, colors, typography, overall fidelity.

#### Step 4. Iterate this target

If Claude identifies differences:
- Fix CSS/styles
- Wait for hot reload
- Re-run capture.ts (Step 2) **for this target**
- Re-compare (Step 3)

**Exit condition per target:** stall counter = 3 → escalate to human.

When this target passes, mark it done and move to the **next target**.

**IMPORTANT: Do NOT skip remaining targets. ALL targets must reach visual GREEN
before proceeding to Step 4-b.**

#### Step 4-b. Verify actual route (when accessible)

After ALL preview targets pass, capture the actual production route and compare
it against the preview screenshot to detect drift.
See [references/route-verification.md](references/route-verification.md) for details.

### Step 5. Save baselines

When ALL targets pass visual verification:
- Each final actual screenshot becomes a **regression baseline**
- Copy each to `visual-qa/expected/<target-name>-baseline.png`
- Future changes use `diff.ts` (pixelmatch) against these baselines
  (browser vs browser comparison IS reliable)

### >>> STOP — Present Visual Test results to user and wait <<<

Tell the user:
> "Phase 6 complete — Visual Test List N/N verified:
> ```
> VT-1: [label] — ✅ PASS
> VT-2: [label] — ✅ PASS
> ...
> ```
> Ready to finalize (Phase 7)?"

**Do NOT declare Phase 6 complete until EVERY VT item is ✅.**
If any VT items remain ⬜ or ❌, you are NOT done. Continue processing.

**Do NOT proceed to Phase 7 until the user confirms.**

---

## PHASE 7 — Completion & Report

### Completion Report (MANDATORY)

**You MUST output a structured completion report to the user.** Never end with just "완료" or a generic message. Follow the report template in [references/completion-guide.md](references/completion-guide.md).

The report must include:
1. Workflow A results (classification, test counts, TDD cycle details, stall info)
2. Workflow B results (Visual Test List outcomes per VT item, iteration counts)
3. All created/modified files with descriptions
4. Issues or notes

See [references/completion-guide.md](references/completion-guide.md) for the full template, artifact list, .gitignore additions, and regression testing setup.

---

## Checklist

### Workflow A — Interaction TDD
- [ ] **0-1.** Figma MCP design context gathered (tokens, structure, dimensions)
- [ ] **0-2.** fileKey, nodeId, viewport dimensions saved for Workflow B
- [ ] **0-3.** Interaction spec generated — **STOP, wait for user to confirm spec**
- [ ] **1-1.** Complexity classified (style-only / interactive / ambiguous → asked) — **STOP, wait for user to confirm classification**
- [ ] **2-1.** `/dev/preview` route exists (component tasks)
- [ ] **2-2.** API mocking strategy determined (MSW / page.route / none)
- [ ] **2-3.** All tests written in `e2e/<task>.spec.ts` — **STOP, wait for user**
- [ ] **3-1.** Tests run, all RED confirmed — **STOP, wait for user**
- [ ] **4-1.** Implementation complete, all GREEN confirmed — **STOP, wait for user**

### Workflow B — Visual TDD
- [ ] **5-1.** Visual Test List built (≥ 1 VT item per Figma nodeId from Phase 0) — **STOP, wait for user**
- [ ] **5-2.** Expected images downloaded for ALL VT items via figma-export.ts (REST API, NOT MCP)
- [ ] **5-3.** Download verified — ALL VT items have expected images on disk
- [ ] **6-1.** capture.ts screenshot taken for EACH VT item (one per state/variant)
- [ ] **6-2.** Claude visual comparison for EACH VT item (local files only, no MCP)
- [ ] **6-3.** ALL VT items marked ✅ PASS — no item skipped
- [ ] **6-4.** Actual route vs preview comparison (Step 4-b) — drift check passed — **STOP, wait for user**
- [ ] **7-1.** Baseline saved, artifacts committed

---

## CI Integration

See [references/ci-guide.md](references/ci-guide.md) for guidance on running
interaction tests and visual regression in CI pipelines.
