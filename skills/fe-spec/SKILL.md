---
name: fe-spec
description: >
  Frontend UI design context collection and interaction spec generation.
  Collects design context from a Figma URL via Figma MCP, or analyzes
  existing code to generate a spec. Classifies complexity as style-only
  or interactive. In checkpoint mode, plans the work as ordered checkpoints.
  Activate on "create a spec for this design",
  "analyze this component", "spec this page".
license: MIT
allowed-tools: Read Glob Grep
metadata:
  author: ludacirs
  version: "2.0"
---

# Frontend Spec — Context & Classification

Collect context from Figma design or existing code, generate an interaction spec, and classify complexity.

```dot
digraph fe_spec {
  node [shape=box];
  input [label="Input mode" shape=diamond];
  figma [label="Figma MCP\nget_design_context"];
  code [label="Code analysis\nRead + Grep"];
  spec [label="Generate Interaction Spec"];
  clarify [label="Ask unknowns"];
  confirm_spec [label="STOP\nuser confirms spec" style=bold];
  classify [label="Complexity Classification\nstyle-only / interactive"];
  confirm_class [label="STOP\nuser confirms classification" style=bold];
  plan [label="Checkpoint Plan\nlogic / style-only / interactive per CP"];
  confirm_plan [label="STOP\nuser approves spec + plan" style=bold];
  mode [label="Mode" shape=diamond];

  input -> figma [label="Figma URL"];
  input -> code [label="Code path"];
  figma -> spec;
  code -> spec;
  spec -> clarify;
  clarify -> mode;
  mode -> confirm_spec [label="classic"];
  confirm_spec -> classify;
  classify -> confirm_class;
  mode -> plan [label="checkpoint"];
  plan -> confirm_plan;
}
```

## Modes

| Mode | When | User STOPs |
|------|------|------------|
| **classic** (default) | Checkpoint mode not requested | 2 — spec, then classification |
| **checkpoint** | fe-harness or the user requests checkpoint mode | 1 — spec and checkpoint plan together |

## ABSOLUTE RULES

1. **Classic mode:** do not start classification until the user confirms the spec.
2. **Checkpoint mode:** present the spec and the checkpoint plan in one STOP. Do not proceed until the user approves both.
3. **Do not write any code before the mode's last STOP is confirmed.** No test code, no implementation code.

## Input Modes

| Mode | Input | Action |
|------|-------|--------|
| **Figma** | Figma URL (fileKey, nodeId) | Figma MCP `get_design_context` → design tokens, structure, inline screenshot |
| **Code** | File path or component name | Read code → identify current state, interactions, routing |

## Phase 0 — Context & Spec Generation

### Figma Mode

#### Step 1. Collect design context via Figma MCP

```
mcp__figma__get_design_context({ fileKey, nodeId })
→ design tokens, colors, spacing, component structure
→ inline screenshot (conversation reference only — CANNOT be saved to disk)
→ frame width × height (save for visual TDD viewport matching)
```

> **No image download in this phase.** Image downloads happen in fe-visual-tdd.
> Save `fileKey`, `nodeId`, and frame dimensions.

#### Step 2. Generate interaction spec

Synthesize a structured spec from the Figma design + task description.
Follow the [references/spec-template.md](references/spec-template.md) template.
Include: initial state, interactions, edge cases, API calls, visual reference (fileKey, nodeId, viewport).

### Code Mode

#### Step 1. Collect context via code analysis

```
1. Read the target files
2. Search for related components/pages with Grep
3. Identify routing, state management, API calls
4. List current interactions
```

#### Step 2. Generate interaction spec

Synthesize a spec based on the current code state.
Follow the [references/spec-template.md](references/spec-template.md) template.
Include: initial state, interactions, edge cases, API calls.
Visual Reference section can be omitted or limited to viewport only when there is no Figma.

### Common — Step 3. Ask unknowns

Ask the user when:
- Figma is missing state variants (hover, loading, error) that are expected
- A button exists but the post-click behavior is unclear
- API calls are expected but success/failure handling is not in the design
- Conditional rendering exists but conditions are unclear

### Common — Step 4. User confirms spec

Checkpoint mode: skip this STOP and go to [Phase 1 — Checkpoint Plan](#phase-1--checkpoint-plan-checkpoint-mode).

Classic mode: present the generated spec. The user confirms or requests revisions.

### >>> STOP — Present spec and wait <<<

> "Phase 0 complete. Here is the interaction spec: [spec]. Please confirm or request changes."

<HARD-GATE>
Do not proceed to Phase 1 until the user confirms the spec.
</HARD-GATE>

---

## Phase 1 — Complexity Classification (classic mode)

Classify **before** any implementation.

| Complexity | Criteria | Path |
|------------|----------|------|
| **style-only** | Color, spacing, font, layout changes only. No new interactions. | fe-visual-tdd only |
| **interactive** | New components, forms, modals, navigation, state changes. | fe-interaction-tdd → fe-visual-tdd |
| **ambiguous** | Unclear whether interactions change. | Ask the user |

**When ambiguous, ask:**
- "Does this task change only styles, or does it also change interactions?"
- "Does existing behavior remain unchanged?"

### Rationalization Table — If you think this, STOP

| If you think… | What you must do |
|----------------|-----------------|
| "This is a simple change, skip the spec" | Create the spec first. Even simple-looking tasks can have unclear scope. |
| "I can tell what to do from the code, no spec needed" | Code shows current state, not the target state. Create the spec. |
| "Classification is obvious, skip user confirmation" | Always get user confirmation. Wrong classification → wrong entire path. |

### >>> STOP — Present classification and wait <<<

> "Phase 1 complete. Classified as [style-only/interactive]. Path: [fe-visual-tdd only / fe-interaction-tdd → fe-visual-tdd]. Please confirm."

<HARD-GATE>
Do not write any code until the user confirms the classification.
</HARD-GATE>

---

## Phase 1 — Checkpoint Plan (checkpoint mode)

Split the spec into checkpoints (CP-1 … CP-n), each reviewable in a few minutes.
Fill the Checkpoint Plan table in [references/spec-template.md](references/spec-template.md).

### Step 1. Read the state fixture catalog

List `e2e/fixtures/states/`. Fill each CP's state column with existing names;
mark states that do not exist yet as `(new)`.

### Step 2. Classify each checkpoint

| Classification | Criteria | RED/GREEN signal |
|----------------|----------|------------------|
| **logic** | No rendering: pure functions, data conversion, validation, UI-less hooks. Project has jest or vitest in package.json | Unit tests |
| **style-only** | Static markup and styles. No new interactions | Visual comparison (VT items) |
| **interactive** | Interactions, state changes, wiring into pages. Also pure logic when package.json has neither jest nor vitest | Playwright tests tagged `@CP-n` |

### Step 3. Apply the split rules

- Each CP has **at most 5 test items** and an expected diff of about 150 lines or less. Larger → split it.
- Order: logic → static UI → wiring and interactions → empty/error states.
- After each CP, the build and every earlier CP's tests still pass.
- Every IT and VT item from the spec belongs to exactly one CP.

| If you think… | What you must do |
|----------------|-----------------|
| "These 7 items are closely related, keep them in one CP" | Split. The limit is 5. |
| "Fewer, bigger CPs mean fewer approvals" | Small CPs are the point. Each approval reviews a small diff. |

### >>> STOP — Present spec and checkpoint plan, wait <<<

> "Spec and checkpoint plan ready: [spec] [plan table]. Please approve or request changes."

<HARD-GATE>
Do not write any code until the user approves the spec and the plan.
</HARD-GATE>

## Output

This skill produces:
1. **Interaction spec** — structured spec document
2. **Classification** — `style-only` or `interactive` (classic mode)
3. **Checkpoint plan** — CP table with per-CP classification (checkpoint mode)
4. **Saved metadata** — fileKey, nodeId, viewport dimensions (Figma mode only)

The next skill (fe-interaction-tdd or fe-visual-tdd) receives this output as input.

## Checklist

- [ ] Design context collected (Figma MCP or code analysis)
- [ ] fileKey, nodeId, viewport dimensions saved (Figma mode)
- [ ] Interaction spec generated
- Classic mode:
  - [ ] Spec — **STOP, wait for user confirmation**
  - [ ] Complexity classified (style-only / interactive / ambiguous → ask) — **STOP, wait for user confirmation**
- Checkpoint mode:
  - [ ] `e2e/fixtures/states/` listed
  - [ ] Checkpoint plan built (≤5 test items per CP, ordered, every IT/VT assigned)
  - [ ] Spec + plan — **STOP, wait for user approval**
