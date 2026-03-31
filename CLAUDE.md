# fe-harness skill suite

## Project Structure

```
skills/
├── fe-harness/          Orchestrator — full flow (spec → interaction → visual → verify → finish)
├── fe-spec/             Context collection + interaction spec generation + classification
├── fe-interaction-tdd/  Playwright e2e tests → RED → GREEN
└── fe-visual-tdd/       Screenshot capture → Figma comparison → baseline
```

## Frontend Skill Routing

For frontend UI work (component implementation, page implementation, style changes,
Figma design implementation), use fe-harness skills instead of superpowers
test-driven-development for TDD.

- Full flow: `fe-harness` (orchestrator)
- Interaction tests only: `fe-interaction-tdd`
- Visual baseline only: `fe-visual-tdd`

## Development Rules

- SKILL.md files are written in English for reliable Claude instruction following.
- After modifying any SKILL.md, run evals to verify rules are not broken:
  ```bash
  cd skills/fe-harness/evals && bash run-all.sh
  ```
- References are already in English — do not translate to other languages.
- Eval prompts include "answer in English" to prevent CLAUDE.md language override.

## Key Invariants

- Each skill's STOP gates must be respected — never bypass user confirmation.
- RED must be confirmed before any implementation code is written.
- Figma MCP is for design spec only — image downloads use REST API (figma-export.ts).
- diff.ts is browser-vs-browser only — never for Figma-vs-browser comparison.
