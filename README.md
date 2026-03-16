# frontend-visual-tdd

A [Claude Code skill](https://agentskills.io) for visual TDD on React frontends.

Uses **Playwright screenshot diff (pixelmatch)** as the RED/GREEN signal —
because AI agents write code and tests simultaneously, making unit tests an
unreliable gate. When Figma MCP is connected, expected images are extracted
automatically from your designs.

Works with: Claude Code, Cursor, Codex, OpenCode, and any agent that supports
the [Agent Skills spec](https://agentskills.io).

## Install

> **Project-level only** — do not install globally.
> The skill instructions reference `.claude/skills/` paths relative to the
> project root, so a global install (`~/.claude/skills/`) will break script
> execution. Install once per project that needs it.

```bash
npx skills add ludacirs/frontend-visual-tdd
```

Then run setup once to install Playwright and Chromium:

```bash
cd .claude/skills/frontend-visual-tdd/scripts
npm run setup
```

## What it does

- **Component / Page / Flow** — covers all three test scopes in one skill
- **Figma MCP integration** — pulls expected images directly from your designs
- **API mocking** — `--mock-routes` intercepts fetch calls so pages render fully
- **Refactor safety** — captures current rendering as baseline before code changes
- **superpowers compatible** — auto-triggers during `writing-plans` for any frontend UI task

## Workflow

```
PHASE 0  extract expected.png from Figma (or capture baseline for refactors)
PHASE 1  capture actual screenshot → run diff → confirm RED
PHASE 2  implement → iterate until GREEN (≤ threshold)
PHASE 3  refactor → commit expected/ + config.json
```

## Requirements

- Node.js 18+
- Figma MCP (optional — falls back to assertion mode without it)
