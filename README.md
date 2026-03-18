# fe-harness

A [Claude Code skill](https://agentskills.io) for frontend development with
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

## What it does

### Two feedback loops

```
PHASE 0  Gather Figma design + generate interaction spec
  ↓ [user confirms spec]
PHASE 1  Classify complexity (style-only / interactive / ambiguous)
  ↓ [user confirms classification]
PHASE 2  Interaction TDD — write Playwright tests → RED → implement → GREEN
  ↓ [user confirms to proceed]
PHASE 3  Visual verification — capture screenshot → compare with Figma → iterate
  ↓ [user confirms visual match]
PHASE 4  Save baseline + accumulate harness artifacts in project
```

### Adaptive complexity

| Complexity | Path |
|------------|------|
| **style-only** | Skip interaction TDD → visual verification only |
| **interactive** | Full TDD loop → visual verification |
| **ambiguous** | Ask human before proceeding |

### Key features

- **AI spec generation** — synthesizes Figma design + task description into interaction specs, asks human when unclear
- **Interaction TDD** — Playwright tests written before implementation, real RED/GREEN gate
- **Visual verification** — Claude compares Figma screenshot vs browser rendering (not pixel diff)
- **Regression** — `diff.ts` (pixelmatch) for browser-to-browser comparison after baseline is established
- **API mocking** — detects MSW or falls back to `page.route()`; `--mock-routes` for capture.ts
- **Harness accumulation** — tests, preview routes, and baselines stay in the project as permanent infrastructure
- **Stall detection** — stops and escalates to human when progress stalls (3 consecutive non-improvements)

## Scripts

| Script | Purpose |
|--------|---------|
| `capture.ts` | Playwright screenshot (component / page / flow) |
| `diff.ts` | pixelmatch comparison — **regression only** (browser vs browser) |
| `figma-export.ts` | Download Figma frame images via REST API |

All scripts support `--help` for usage details.

## Requirements

- Node.js 18+
- Figma Personal Access Token (`figd_*`) for design export
- Figma MCP connection for design spec retrieval
