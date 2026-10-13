# Test Setup Guide

## Playwright Test setup

If the project doesn't have Playwright configured, set it up:

- `playwright.config.ts` at project root
- `e2e/` directory for test files
- This setup is **permanent** — it stays in the project as harness infrastructure.

## `/dev/preview` route — for component-type tasks

- URL pattern: `/dev/preview?component=<ComponentName>`
- Place outside auth layout groups (no login required)
- Add dev-only guard (`import.meta.env.DEV` or equivalent)
- Separate preview wrapper per component (e.g., `<Name>.preview.tsx`)
- For components with API calls: register MSW handlers or use `page.route()`
  in the preview file

## API Mocking Decision Tree

```
Does the task make API calls?
  │
  ├── No → proceed without mocking
  │
  └── Yes → responses come from e2e/fixtures/states/ (see state-fixtures.md)
        │
        ├── MSW present (msw in package.json)
        │   → Node (setupServer): build handlers with stateHandlers(...)
        │   → Browser worker / preview file: import the state JSON files directly
        │
        └── No MSW
            → useStates(page, 'profile.diagnosisDone', ...) in the test

If API endpoints or response shapes are unknown → ask human.
```
