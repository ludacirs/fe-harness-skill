# State Fixtures

A state fixture is a named API state that tests and screenshots reuse, so a screen
that needs "a user who finished the diagnosis" opens without a real account in that state.

## Layout

```
e2e/fixtures/states/
  profile.diagnosisDone.json
  profile.onboardingOnly.json
  report.toefl.basic.json
  report.toefl.empty.json
  report.error500.json
  load.ts
```

- File name = state name: `<domain>.<state>.json`. The directory listing is the catalog.
- One file describes one state of one domain. A screen combines several states.

## File format

Same format as `--mock-routes` in fe-visual-tdd's `capture.ts`
(see [mock-routes-example.json](mock-routes-example.json)): an array of routes.

```json
[
  {
    "_comment": "Diagnosis finished, TOEFL target",
    "pattern": "**/api/v1/profile",
    "response": { "id": 1, "diagnosisStatus": "DONE", "targetExam": "TOEFL" }
  }
]
```

| Field | Meaning |
|-------|---------|
| `pattern` | Playwright URL glob. Use the full host when the API is on an absolute external URL |
| `response` | JSON body |
| `status` | Default 200 |
| `body` + `contentType` | Non-JSON body |
| `abort` | Network failure |

## Loading in Playwright tests

Create `e2e/fixtures/states/load.ts` once:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

type Route = { pattern: string; response?: unknown; status?: number; body?: string; contentType?: string; abort?: boolean };

export function readStates(...names: string[]): Route[] {
  return names.flatMap((name) =>
    JSON.parse(readFileSync(join(__dirname, `${name}.json`), 'utf-8')) as Route[],
  );
}

export async function useStates(page: Page, ...names: string[]) {
  for (const r of readStates(...names)) {
    await page.route(r.pattern, (route) =>
      r.abort
        ? route.abort()
        : route.fulfill({
            status: r.status ?? 200,
            contentType: r.contentType ?? 'application/json',
            body: r.body ?? JSON.stringify(r.response ?? {}),
          }),
    );
  }
}
```

```ts
test('IT-3 expands the score section', async ({ page }) => {
  await useStates(page, 'profile.diagnosisDone', 'report.toefl.basic');
  await page.goto('/report/toefl');
  // ...
});
```

When two states register the same `pattern`, the later name wins (Playwright runs the
most recently registered handler first).

## Loading in MSW (projects with msw in package.json)

Build handlers from the same files instead of writing response bodies in handlers:

```ts
import { http, HttpResponse } from 'msw';
import { readStates } from '../../e2e/fixtures/states/load';

export const stateHandlers = (...names: string[]) =>
  readStates(...names).map((r) =>
    http.all(r.pattern, () =>
      r.abort
        ? HttpResponse.error()
        : new HttpResponse(r.body ?? JSON.stringify(r.response ?? {}), {
            status: r.status ?? 200,
            headers: { 'Content-Type': r.contentType ?? 'application/json' },
          }),
    ),
  );
```

`readStates` uses `node:fs`, so this works for MSW in Node (`setupServer`).
For the browser worker, import the JSON files directly instead.

## Screenshots (capture.ts)

A single state file passes as-is:

```bash
npx tsx scripts/capture.ts ... --mock-routes e2e/fixtures/states/report.toefl.basic.json
```

Several states → merge first. Later files win on the same pattern, matching `useStates`:

```bash
jq -s 'add' e2e/fixtures/states/profile.diagnosisDone.json \
  e2e/fixtures/states/report.toefl.basic.json > visual-qa/results/states.json
npx tsx scripts/capture.ts ... --mock-routes visual-qa/results/states.json
```

## Real accounts

Fixtures replace real accounts during the loop. Checking the screen with a real dev
account in that state is a manual step: list it under "수동 확인 필요" in the completion report.
