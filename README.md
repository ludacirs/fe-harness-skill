# fe-harness

A [Claude Code skill](https://agentskills.io) suite for frontend development with
two feedback loops: **Interaction TDD** (Playwright tests) then
**Visual Verification** (Figma comparison).

AI agents write code and tests simultaneously, making unit tests an unreliable
gate. This skill fixes that by generating interaction specs from Figma + task
descriptions, writing Playwright tests *before* implementation (real RED signal),
then verifying visual fidelity against Figma designs.

Works with: Claude Code, Cursor, Codex, OpenCode, and any agent that supports
the [Agent Skills spec](https://agentskills.io).

## Install

> **Project-level only** — do not install globally.
> The skill references `skills/` paths relative to the project root,
> so a global install will break script execution.

```bash
npx skills add ludacirs/fe-harness-skill
```

Then run setup once to install Playwright and Chromium:

```bash
cd skills/fe-harness/scripts
npm run setup
```

## Skill Suite

fe-harness is split into 4 independent skills that can be triggered individually
or orchestrated together.

| Skill | Role | Trigger Examples |
|-------|------|------------------|
| **fe-spec** | Context collection + spec generation + classification | "Create a spec for this design", "Analyze this component" |
| **fe-interaction-tdd** | Playwright e2e tests → RED → GREEN | "Add e2e tests to this page", "Write tests for this component" |
| **fe-visual-tdd** | Screenshot capture → Figma comparison → baseline | "Capture visual baseline", "Compare screenshots with Figma" |
| **fe-harness** | Orchestrator (full flow) | "Implement this Figma design", "Build this component" |

### Full Flow (fe-harness orchestrator)

```
fe-spec                     Context & Spec & Classification
  ↓ [user confirms spec]
  ↓ [user confirms classification]
  ↓
  ├── style-only ──────────→ fe-visual-tdd
  │                            ↓
  └── interactive ──────────→ fe-interaction-tdd → fe-visual-tdd
                                                      ↓
                              Completion Report ←─────┘
                                ↓
                              superpowers verification-before-completion
                                ↓
                              superpowers finishing-a-development-branch
```

### Independent Usage

Each skill works standalone:

- **fe-spec only** — Generate a spec from Figma or existing code without building anything
- **fe-interaction-tdd only** — Add e2e tests to existing code (analyzes code → generates spec → writes tests → RED → GREEN)
- **fe-visual-tdd only** — Capture visual baselines without Figma (baseline mode) or compare against Figma

### superpowers Integration

fe-harness is designed to work alongside [superpowers](https://github.com/obra/superpowers).
For frontend UI work, fe-harness skills replace superpowers' `test-driven-development` skill.
Add this to your project's `CLAUDE.md` to enable routing:

```markdown
For frontend UI work (component/page implementation, style changes, Figma design
implementation), use fe-harness skills instead of superpowers test-driven-development.
```

## Key Features

- **Dual input mode** — start from a Figma URL or from existing code
- **AI spec generation** — synthesizes Figma design + task description into interaction specs, asks human when unclear
- **Interaction TDD** — Playwright tests written before implementation, real RED/GREEN gate
- **Visual verification** — Claude compares Figma screenshot vs browser rendering (not pixel diff)
- **Regression** — `diff.ts` (pixelmatch) for browser-to-browser comparison after baseline is established
- **API mocking** — detects MSW or falls back to `page.route()`; `--mock-routes` for capture.ts
- **Harness accumulation** — tests, preview routes, and baselines stay in the project as permanent infrastructure
- **Stall detection** — stops and escalates to human when progress stalls (3 consecutive non-improvements)
- **STOP gates** — each phase requires explicit user confirmation before proceeding

## Scripts

| Script | Purpose |
|--------|---------|
| `capture.ts` | Playwright screenshot (component / page / flow) |
| `diff.ts` | pixelmatch comparison — **regression only** (browser vs browser) |
| `figma-export.ts` | Download Figma frame images via REST API |

All scripts support `--help` for usage details.

## Evals

Each skill has behavioral tests that verify STOP gates, phase separation, and rule enforcement:

```bash
# Run all skills' tests
cd skills/fe-harness/evals
bash run-all.sh

# Run a single skill's tests
cd skills/fe-spec/evals
bash run-all.sh
```

## Requirements

- Node.js 18+
- Figma Personal Access Token (`figd_*`) for design export
- Figma MCP connection for design spec retrieval
