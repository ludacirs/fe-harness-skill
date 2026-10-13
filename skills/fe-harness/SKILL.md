---
name: fe-harness
description: >
  Frontend UI full-flow orchestrator. Runs fe-spec → fe-interaction-tdd → fe-visual-tdd
  in sequence for Figma design implementation or component/page development, then
  finishes with superpowers verification and branch completion.
  Activate on "implement this Figma design", "build this component", "implement this page".
  Replaces superpowers test-driven-development for frontend work.
license: MIT
allowed-tools: Bash(npx:*) Bash(npm:*) Read Write Edit Glob Grep
metadata:
  author: ludacirs
  version: "2.0"
---

# Frontend Harness — Orchestrator

Orchestrates the full flow for frontend UI work.
Each step is an independent skill; this orchestrator invokes them in order.

```dot
digraph fe_harness {
  node [shape=box];

  fe_spec [label="1. fe-spec\nContext & Spec & Classify"];
  classify [label="Classification result" shape=diamond];
  fe_interaction_tdd [label="2. fe-interaction-tdd\ne2e RED → GREEN"];
  fe_visual_tdd [label="3. fe-visual-tdd\nCapture → Compare → Baseline"];
  report [label="4. Completion Report"];
  verification [label="5. superpowers\nverification-before-completion"];
  finishing [label="6. superpowers\nfinishing-a-development-branch"];

  fe_spec -> classify;
  classify -> fe_interaction_tdd [label="interactive"];
  classify -> fe_visual_tdd [label="style-only"];
  fe_interaction_tdd -> fe_visual_tdd;
  fe_visual_tdd -> report;
  report -> verification;
  verification -> finishing;
}
```

## Modes

| Mode | When | Flow |
|------|------|------|
| **classic** (default) | Checkpoint mode not requested | [Execution Flow](#execution-flow) below |
| **checkpoint** | The user requests checkpoint mode | [Checkpoint Mode](#checkpoint-mode) |

## Execution Flow

### Step 1. Invoke fe-spec

Invoke `fe-spec` via the Skill tool. Receive the spec and classification result.

- Figma URL present → Figma mode
- Code path only → Code mode
- Follow all STOP gates defined by fe-spec

### Step 2. Branch by Classification

| Classification | Path |
|----------------|------|
| **style-only** | Invoke fe-visual-tdd only (skip to Step 3) |
| **interactive** | Invoke fe-interaction-tdd, then fe-visual-tdd |

### Step 2-a. Invoke fe-interaction-tdd (interactive only)

Invoke `fe-interaction-tdd` via the Skill tool. Pass the interaction spec from fe-spec.

- Follow all STOP gates defined by fe-interaction-tdd
- Wait until GREEN is confirmed

### Step 3. Invoke fe-visual-tdd

Invoke `fe-visual-tdd` via the Skill tool.

- Figma nodeId present → Figma mode
- No nodeId → Baseline mode
- Follow all STOP gates defined by fe-visual-tdd

### Step 4. Completion Report

Refer to [references/completion-guide.md](references/completion-guide.md) to report artifacts and regression setup.

### Step 5. superpowers verification-before-completion

Invoke `superpowers:verification-before-completion` via the Skill tool.

- Verify full test suite passes
- Verify lint/typecheck passes
- Verify build succeeds

### Step 6. superpowers finishing-a-development-branch

Invoke `superpowers:finishing-a-development-branch` via the Skill tool.

- Present commit/PR/merge options

## Checkpoint Mode

The unit of work is a checkpoint (CP) small enough to review in a few minutes.
Each CP passes automatic gates, then one user approval commits it.

```
fe-spec (checkpoint mode) ─ STOP: spec + plan
  └─ for CP-1 … CP-n, in order:
       G1  tests → RED       (automatic, RED evidence block)
       G2  implement → GREEN (automatic, GREEN evidence block)
       G5  STOP: checkpoint report → approve → commit
  → fe-visual-tdd (all VT items) → completion report → verification → finishing
```

User STOPs: plan approval once + G5 once per CP. Nothing else asks the user unless an
evidence condition fails.

### Step C1. Plan

Invoke `fe-spec` in checkpoint mode. Its one STOP approves the spec and the checkpoint plan.

### Step C2. Run each checkpoint

**G1–G2 (logic / interactive CPs).** Invoke `fe-interaction-tdd` in checkpoint mode with the
CP id, classification, test items, and state fixtures. It returns a RED evidence block, then
a GREEN evidence block, without stopping in between.

**G2 (style-only CPs).** Implement only. No RED/GREEN; the CP's VT items are verified in Step C3.

**Evidence condition fails** (RED cannot be shown, stall counter hits 3, an earlier CP's test
breaks) → stop the loop and hand it to the user with the evidence block.

**G5 — STOP: checkpoint report.** Present it in this shape and wait:

```markdown
## CP-3 — Wire sections into page, expand
- diff: 3 files, +118 −12
- RED → GREEN: IT-3, IT-4 (evidence blocks below), earlier CP tests 4/4 passing
- state fixtures: profile.diagnosisDone, report.toefl.basic
- next: CP-4 Empty and error states
<RED evidence block>
<GREEN evidence block>
```

| User answer | Action |
|-------------|--------|
| Approve | Commit this CP (one commit per CP), start the next CP |
| Request changes | Take the reason, redo from G2, present G5 again |
| Revise plan | Re-plan the remaining CPs with fe-spec, then continue |

### Step C3. Finish

After the last CP: Step 3 (fe-visual-tdd for all VT items) → Step 4 → Step 5 → Step 6
of the classic flow. The completion report adds one line per CP (title, commit, items).

## ABSOLUTE RULES

1. **Never skip skill order.** fe-spec → (fe-interaction-tdd →) fe-visual-tdd → verification → finishing.
2. **Classic mode: respect each sub-skill's STOP gates.** The orchestrator must not override or bypass a sub-skill's STOP.
3. **Checkpoint mode: sub-skill phase STOPs become evidence blocks.** User STOPs are the plan
   approval and G5 for every CP. A CP is never committed without its G5 approval.
4. **Checkpoint mode: one CP at a time.** CP-n+1 starts only after CP-n is committed.
5. **Follow the exact path for the classification result.** Never skip fe-interaction-tdd when classification is interactive.

### Rationalization Table — If you think this, STOP

| If you think… | What you must do |
|----------------|-----------------|
| "This is a simple change, skip spec and jump to implementation" | Start with fe-spec. Always. |
| "Tests already exist, skip fe-interaction-tdd" | If classified as interactive, it must run. |
| "Visual verification can wait until later" | fe-visual-tdd must complete before the completion report. |
| "Verification isn't really necessary" | superpowers verification checks overall project health. Always run it. |
| "GREEN and build pass, commit and keep going" | Checkpoint mode: commit only after G5 approval. |
| "Two CPs are small, approve them together" | One G5 per CP. |

## Checklist

Classic mode:

- [ ] Invoke fe-spec → obtain spec + classification
- [ ] Select correct path based on classification
- [ ] (interactive) Invoke fe-interaction-tdd → obtain GREEN
- [ ] Invoke fe-visual-tdd → obtain baseline
- [ ] Output completion report
- [ ] Invoke superpowers verification-before-completion
- [ ] Invoke superpowers finishing-a-development-branch

Checkpoint mode:

- [ ] Invoke fe-spec in checkpoint mode → spec + plan approved
- [ ] Per CP: RED evidence → GREEN evidence → G5 report — **STOP, wait for approval** → commit
- [ ] Invoke fe-visual-tdd → all VT items
- [ ] Completion report (with per-CP lines) → verification → finishing
