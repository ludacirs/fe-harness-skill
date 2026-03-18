---
name: fe-harness
description: >
  Use when implementing any frontend UI work — building components,
  implementing pages, changing styles, or creating interaction flows.
  Activate when working from a Figma design or when the user asks to
  "implement this design", "build this component", "match this mockup",
  or any frontend task needing quality verification.
---

# Frontend Harness

Two-loop feedback harness: **Interaction TDD** (behavior) then **Visual Verification** (appearance).

Proceed through phases one at a time. At each phase boundary,
**stop, show what you did, and ask the user before moving on.**

```
PHASE 0 → PHASE 1 → PHASE 2 → PHASE 3 → PHASE 4
Context    Classify   TDD        Visual     Complete
  ↓          ↓         ↓          ↓          ↓
 [ask]     [ask]     [ask]      [ask]      [done]
```

## Setup (once per project)

```bash
cd skills/fe-harness/scripts && npm run setup
```

## Gotchas

- **Figma MCP screenshots cannot be saved to disk.** Use `figma-export.ts` for files.
- **No pixel-diff for Figma vs browser.** Use Claude visual comparison. `diff.ts` is browser-to-browser only.
- **Figma nodeId format.** URL `node-id=123-456` → API `123:456`.
- **Stall counter = 3.** Stop and escalate after 3 consecutive non-improvements.

---

## PHASE 0 — Context & Spec

1. **Figma design spec** — call `mcp__figma__get_design_context({ fileKey, nodeId })` to get tokens, spacing, structure, and frame dimensions.

2. **Figma expected image** — download via REST API:
   ```bash
   npx tsx skills/fe-harness/scripts/figma-export.ts \
     --file-key <FILE_KEY> --node-ids <NODE_ID> \
     --out visual-qa/expected --scale 1
   ```
   See [references/figma-reference.md](references/figma-reference.md) for nodeId and scale details.

3. **Generate interaction spec** — synthesize Figma + task description into:
   - Initial state (what user sees on load)
   - Interactions (action → expected result)
   - Edge cases (error, empty, loading)
   - API calls (endpoint + mock response shape)

   See [references/spec-template.md](references/spec-template.md) for full template.

4. **Clarify unknowns** — ask the user when: no state variants in Figma, unclear post-click behavior, unknown API handling, unclear conditional rendering.

### STOP — present spec and ask:
> "Spec이 맞는지 확인해주세요. 수정할 부분이 있으면 알려주세요."

**Do NOT proceed until the user confirms.**

---

## PHASE 1 — Classify

Classify the task:

| Type | Criteria | Path |
|------|----------|------|
| **style-only** | Color, spacing, font, layout. No new interactions. | Skip PHASE 2 → PHASE 3 |
| **interactive** | New component, form, modal, navigation, state. | PHASE 2 → PHASE 3 |
| **ambiguous** | Unclear. | Ask the user. |

### STOP — present classification and ask:
> "이 작업은 [type]으로 분류했습니다. [이유]. 맞을까요?"

**Do NOT proceed until the user confirms.**

---

## PHASE 2 — Interaction TDD

> Skipped for style-only tasks.

### 2-1. Setup prerequisites

- **Playwright** — if not present, create `playwright.config.ts` + `e2e/` directory.
- **Preview route** — for component tasks: `/dev/preview?component=<Name>`, outside auth, dev-only guard.

### 2-2. Write Playwright tests FIRST (RED)

Write ALL tests for spec items in `e2e/<task>.spec.ts` **before** any implementation.
- One `test()` per interaction spec item
- Prefer `getByRole`, `getByLabel` selectors
- Component base URL: `/dev/preview?component=<Name>`

### 2-3. Handle API mocking

- MSW present → use existing handlers or add new ones
- No MSW → use `page.route()` inline in tests
- Mock data in `e2e/mocks/`. See [references/mock-routes-example.json](references/mock-routes-example.json).
- Unknown endpoints → ask the user.

### 2-4. Confirm RED

```bash
npx playwright test e2e/<task>.spec.ts
```
All tests must fail. If any pass unexpectedly, investigate.

### 2-5. Implement → GREEN

Implement the component/page. Run tests after each significant change.

**Stall counter:** if passing test count doesn't increase for 3 consecutive runs → stop and escalate:
> "N/M tests passing. Stuck on: [failing test names]. Need guidance."

### STOP — show test results and ask:
> "모든 인터랙션 테스트가 통과했습니다. (N/N) Visual verification으로 넘어갈까요?"

**Do NOT proceed until the user confirms.**

---

## PHASE 3 — Visual Verification

### 3-1. Start dev server if not running

```bash
npm run dev &
npx wait-on http://localhost:<PORT>
```

### 3-2. Capture screenshot

```bash
npx tsx skills/fe-harness/scripts/capture.ts \
  --url  http://localhost:<PORT>/<route-or-preview> \
  --out  visual-qa/actual/<task>.png \
  --type <component|page|flow> \
  --width <W> --height <H>
```
Width/height must match Figma frame dimensions from PHASE 0.

### 3-3. Compare with Figma (Claude visual comparison)

Present both images side by side:
1. Figma expected: `visual-qa/expected/<task>.png`
2. Browser actual: `visual-qa/actual/<task>.png`

Judge: layout, spacing, colors, typography, overall fidelity.

### 3-4. Iterate

If differences found: fix CSS → wait for hot reload → re-capture → re-compare.

**Stall counter:** same as PHASE 2 (3 stalls → escalate to user).

### 3-5. Save baseline

Copy final screenshot to `visual-qa/expected/<task>-baseline.png`.

### STOP — show comparison and ask:
> "Figma 디자인과 비교 결과 시각적으로 일치합니다. 완료 처리할까요?"

**Do NOT proceed until the user confirms.**

---

## PHASE 4 — Completion

Ensure `.gitignore` includes `visual-qa/actual/` and `visual-qa/diff/`.

Present the artifacts created:
```
e2e/<task>.spec.ts              ← interaction tests
e2e/mocks/                      ← API mock data
dev/preview/<Component>.tsx     ← preview route
visual-qa/expected/             ← baseline screenshots
playwright.config.ts            ← project config
```

See [references/ci-guide.md](references/ci-guide.md) for CI integration.

Announce completion.
