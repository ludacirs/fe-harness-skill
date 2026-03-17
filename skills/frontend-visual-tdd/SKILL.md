---
name: frontend-visual-tdd
description: >
  Use when implementing or planning React components, pages, or UI interaction
  flows — especially when a Figma design exists. MUST activate during
  writing-plans whenever any task involves frontend UI work, to add a visual
  test strategy to each task definition. Use instead of (or alongside)
  test-driven-development for frontend UI: AI-written unit tests don't produce
  a real RED signal because the agent writes code and tests simultaneously.
  This skill replaces that signal with a Playwright screenshot diff (pixelmatch)
  as the true RED/GREEN gate. Fully standalone — no other skills required.
  Figma MCP extracts expected images automatically when connected.
---

# Frontend Visual TDD

Visual TDD for frontend UI using **Playwright screenshot diff** as the
RED/GREEN signal. Fully standalone — all browser automation and diff logic
are bundled in `scripts/` (TypeScript, run via `tsx`).

## Why unit tests aren't enough here

```
The AI agent problem:
  writes code → writes tests (simultaneously)
  → tests always pass → no RED signal → TDD loop breaks

This skill's fix:
  extract Figma expected image before implementation  ← real RED
  → capture actual screenshot → run diff
  → diff > threshold = RED  |  diff ≤ threshold = GREEN
```

## Setup

Run once after installing the skill:

```bash
cd .claude/skills/frontend-visual-tdd/scripts
npm run setup        # installs deps + downloads Chromium
```

---

## Task type classification

Classify the task **before doing anything else**.

| Type | When | Screenshot strategy | Default threshold |
|------|------|---------------------|-------------------|
| **component** | Single component, prop variants | Viewport screenshot via `/dev/preview` route | 0.1% |
| **page** | Full route view | `fullPage: true` screenshot | 0.5% |
| **flow** | Click/input interaction sequence | One screenshot per interaction step | 0.5% per step |

If unclear, ask the user once.

> **`/dev/preview` route:** If the project has no isolated render route for
> components, create a minimal one first. Follow the project's routing conventions:
> - URL pattern: `/dev/preview?component=<ComponentName>`
> - Place the route **outside auth layout groups** so no login/session is required
> - Add a **dev-only guard** so the route is inaccessible in production
>   (e.g., `import.meta.env.DEV`, `process.env.NODE_ENV`, or the framework's equivalent)
> - Separate preview wrappers per component (e.g., `<Name>.preview.*`)
> - For components with API calls: register MSW handlers in the preview file
>   instead of using `--mock-routes` (keeps mock data co-located with the preview)

---

## Cycle

### PHASE 0 — Capture expected image (prepare RED)

First, determine the task intent:

```
What kind of task is this?
  │
  ├── New implementation / visual bug fix / redesign
  │     └── Figma MCP connected?
  │           ├── Yes → find frame/component nodeId
  │           │         → run figma-export.ts to download expected image:
  │           │           export FIGMA_TOKEN=<TOKEN>   # or set in .env
  │           │           npx tsx .claude/skills/frontend-visual-tdd/scripts/figma-export.ts \
  │           │             --file-key <FILE_KEY> --node-ids <NODE_ID> \
  │           │             --out visual-qa/expected --scale 1
  │           │         → note Figma frame width × height for viewport match
  │           └── No  → manual: export PNG from Figma UI → save to visual-qa/expected/
  │                     or assertion fallback (write selector/text list; skip diff)
  │
  └── Refactor / internal change (no intentional visual change)
        → capture current rendering as expected BEFORE any code change:
          npx tsx .claude/skills/frontend-visual-tdd/scripts/capture.ts \
            --url  http://localhost:<PORT>/<route> \
            --out  visual-qa/expected/<task>.png \
            --type <component|page|flow> \
            --width <W> --height <H>
          If diff > threshold after changes → unintended visual regression.
```

See `references/figma-mcp.md` for nodeId lookup and image extraction.

> **Scale matching:** Expected and actual images must have the same pixel
> dimensions. Use `--scale 1` in figma-export.ts (default) to match
> Playwright's default deviceScaleFactor of 1. If you need 2x resolution,
> set both: `figma-export.ts --scale 2` and `capture.ts --device-scale-factor 2`.
> Mismatched scales cause inflated diff percentages (e.g., 76%) due to
> resize artifacts and anti-aliasing.

> **Full page vs content area comparison:**
> Figma expected images may include the full layout (nav, sidebar) while the
> preview only renders the content area. Choose a strategy based on what's
> available:
> - **Content node exists in Figma** → export that node's nodeId directly,
>   set capture.ts viewport to match its dimensions. No cropping needed.
> - **Only full page frame available** → include the layout in the
>   preview (mock auth store, add nav/sidebar) so the capture matches the
>   Figma frame structurally.
>
> Do not add a `--selector` cropping option — element boundaries shift
> with dynamic content, making selector-based diffs unreliable.

---

### PHASE 1 — Confirm RED

**Step 1. Start dev server if not running:**
```bash
npm run dev &
npx wait-on http://localhost:<PORT>
```

**Step 2. Handle API calls (if any):**
```
Does the target make API calls?
  │
  ├── no API calls → proceed without mocking
  │
  └── yes → Does the project use MSW?
        │   (Check: `msw` in package.json or `mockServiceWorker.js` in public/)
        │
        ├── MSW active
        │   ⚠ --mock-routes does NOT work when MSW is active.
        │     (MSW intercepts at Service Worker level, before Playwright's
        │      network-level route() can see the request.)
        │
        │   ├── component type → use worker.use() in .preview file to override handlers
        │   └── page/flow type → modify the project's MSW handlers directly
        │         (e.g., src/mocks/handlers.ts) or add conditional overrides
        │
        └── no MSW → use --mock-routes for page/flow types:
              --mock-routes visual-qa/mocks/<task>.json
              See references/mock-routes-example.json for format.
              Mock every API call the page makes — unmocked calls cause
              networkidle to hang or render incomplete state.
              For component type, register mocks in .preview file.
```

> **MSW handler URL matching:** When overriding handlers with `worker.use()`,
> use the `*` glob prefix to match regardless of host:
> ```ts
> worker.use(http.get('*/your/endpoint', handler))
> ```
> This avoids mismatches between path-only (`/api/...`) and full-URL
> (`http://localhost:3000/api/...`) registrations in existing handlers.

> **localStorage-based stores:** Stores that read `localStorage` at module load
> time will initialize **before** `onMount` or `addInitScript` can set values.
> In the preview file, set store state directly via the store's API (e.g.,
> `store.set(...)`, `store.rehydrate()`) rather than writing to `localStorage`
> after mount.

**Step 3. Capture actual screenshot:**
```bash
npx tsx .claude/skills/frontend-visual-tdd/scripts/capture.ts \
  --url         http://localhost:<PORT>/<route> \
  --out         visual-qa/actual/<task>.png \
  --type        <component|page|flow> \
  --width       <W> \
  --height      <H> \
  [--mock-routes visual-qa/mocks/<task>.json] \
  [--steps      visual-qa/steps/<task>.json]
```

**Step 4. Run diff:**
```bash
npx tsx .claude/skills/frontend-visual-tdd/scripts/diff.ts \
  --expected visual-qa/expected/<task>.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold <value>
```

**Step 5. Interpret result:**
- exit 1 (RED) → proceed to PHASE 2
- exit 0 (already GREEN) → confirm with user whether work is needed

*Assertion fallback:* verify selectors/text manually → any failure = RED.

---

### PHASE 2 — Implement (target GREEN)

- Make component / CSS changes.
- After hot reload settles, re-run PHASE 1 steps 3–4 (capture + diff).
- Log each iteration: `iteration N — mismatch X.XXX%`
- Iterate up to **10 times**.
- If still RED after 10 iterations: show `visual-qa/diff/<task>.png` +
  mismatch% to the user and stop for guidance.

---

### PHASE 3 — Refactor + commit

- GREEN confirmed → clean up code (no functional changes).
- Stage for commit:
  ```
  visual-qa/expected/    ← expected images (Figma export or baseline capture)
  visual-qa/mocks/       ← API mock files (if any)
  visual-qa/steps/       ← flow step files (if any)
  visual-qa/config.json  ← thresholds
  ```
- Add to `.gitignore` if not already present:
  ```
  visual-qa/actual/
  visual-qa/diff/
  ```
- Record the task in `visual-qa/config.json`:
  ```json
  { "tasks": { "<task-name>": { "type": "page", "threshold": 0.5 } } }
  ```

---

## writing-plans integration

For each frontend UI task in the plan, append this block so the executing
agent has everything it needs without re-reading this skill:

```markdown
**[Visual TDD]**
- Type: <component | page | flow>
- Intent: <new | bugfix | refactor>
- Figma node: <nodeId or "none — assertion fallback">
- Viewport: <width>x<height>
- Threshold: <0.1 | 0.5>%
- API mocks: <visual-qa/mocks/<task>.json or "none">
- Capture: npx tsx .claude/skills/frontend-visual-tdd/scripts/capture.ts
    --url http://localhost:<PORT>/<route> --out visual-qa/actual/<task>.png
    --type <type> --width <W> --height <H> [--mock-routes ...]
- RED check: npx tsx .claude/skills/frontend-visual-tdd/scripts/diff.ts
    --expected visual-qa/expected/<task>.png
    --actual visual-qa/actual/<task>.png
    --diff visual-qa/diff/<task>.png --threshold <value>
```

---

## File layout

```
.claude/skills/frontend-visual-tdd/
├── SKILL.md
├── scripts/
│   ├── capture.ts              ← Playwright screenshot (component / page / flow)
│   │                             supports --mock-routes for API interception
│   ├── diff.ts                 ← pixelmatch diff, exit 0=GREEN / 1=RED
│   └── package.json            ← playwright + pixelmatch + pngjs + tsx
└── references/
    ├── figma-mcp.md            ← Figma MCP call patterns
    ├── mock-routes-example.json ← API mock format (success / error / abort)
    └── flow-steps-example.json ← interaction step format for --type flow

project root (created at runtime):
visual-qa/
├── expected/    ← expected images             (commit)
├── actual/      ← Playwright captures         (.gitignore)
├── diff/        ← pixelmatch output           (.gitignore)
├── mocks/       ← API mock JSON files         (commit)
├── steps/       ← flow step JSON files        (commit)
└── config.json  ← per-task thresholds         (commit)
```

---

## Checklist

- [ ] Task type classified (component / page / flow)
- [ ] Task intent determined (new/bugfix/redesign → Figma or fallback | refactor → baseline capture)
- [ ] `/dev/preview` route exists (component type only)
- [ ] API calls identified → MSW handlers or `--mock-routes` file prepared
- [ ] PHASE 0: expected.png saved or assertion list written
- [ ] PHASE 1: RED confirmed
- [ ] PHASE 2: GREEN achieved
- [ ] PHASE 3: expected/ + mocks/ + steps/ + config.json committed
