# fe-harness

Frontend UI skill suite.

## Skill Structure

| Skill | Role | Independent Trigger |
|-------|------|---------------------|
| `fe-spec` | Context collection + spec generation + classification | "Create a spec for this design" |
| `fe-interaction-tdd` | e2e tests → RED → GREEN | "Add e2e tests to this page" |
| `fe-visual-tdd` | Screenshot capture → compare → baseline | "Capture visual baseline" |
| `fe-harness` | Orchestrator (full flow) | "Implement this Figma design" |

## Frontend Skill Routing

For frontend UI work (component implementation, page implementation, style changes,
Figma design implementation), use fe-harness skills instead of superpowers
test-driven-development for TDD.

## Tests

```bash
cd evals
bash run-all.sh
```

After modifying SKILL.md, always run tests to verify existing rules are not broken.
