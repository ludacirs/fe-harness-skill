# Preview Construction Guide

## Construction rules (CRITICAL)

- Preview MUST import and render actual production components.
  Duplicating markup makes visual verification meaningless —
  it verifies the copy, not the real code.
- Import sub-components that accept props, pass mock data as props.
- If a page component calls API hooks internally, import its
  presentational sub-components instead. If none exist, extract
  the UI into a presentational component first, then use that
  in both the page and the preview.
- NEVER copy-paste JSX from the target component into the preview.

## File-based router

If the project uses a file-based router (TanStack Router, Next.js, etc.),
preview files placed under route directories (e.g., `dev/preview/<Component>.tsx`)
may be interpreted as actual routes. Follow the project's routing conventions for
preview file placement — e.g., use a `_dev` prefix, a non-route directory, or
the router's file-exclusion pattern.

## Monorepo

In monorepo setups where e2e tests live in a separate package
(e.g., `apps/my-app-e2e/`):

- Preview files must be placed inside the **main app** package
  (where the dev server runs), not in the e2e package.
- `playwright.config.ts` lives in the e2e package, not project root.
- The e2e package cannot directly import main app components —
  tests interact only via browser URLs.
- Adjust file paths in this guide to match your monorepo structure.
