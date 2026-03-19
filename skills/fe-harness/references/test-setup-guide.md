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
  └── Yes → detect project mocking infrastructure:
        │
        ├── MSW present (msw in package.json)
        │   → Use existing handlers or add new ones
        │   → For component preview routes, configure handlers in the preview file if needed
        │
        └── No MSW
            → Use page.route() inline in test files:
              await page.route('**/api/login', route =>
                route.fulfill({ status: 200, body: JSON.stringify({ token: '...' }) })
              );

If API endpoints or response shapes are unknown → ask human.
```
