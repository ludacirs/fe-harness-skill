# API Mock Troubleshooting

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `page.route('**/api/...')` not intercepting | API host is an absolute external URL (e.g., `http://172.168.x.x/api/...`). Glob patterns like `**/api` only match relative paths. | Use the full URL pattern: `page.route('http://172.168.x.x/api/users', ...)` or `page.route('**/172.168.x.x/**', ...)` |
| Mock works in test but not in capture.ts | capture.ts uses `--mock-routes` JSON, not Playwright test fixtures | Pass mock routes via `--mock-routes mock-routes.json`. See `references/mock-routes-example.json` |
| Component renders with real data instead of mock | MSW handlers not registered in preview file, or dev server not using MSW | Check that preview file imports and activates MSW worker; or use `page.route()` as fallback |
| Mock returns but component shows loading spinner | Response shape doesn't match what component expects | Log `mock.response` and compare with component's API type definition |

## When `page.route()` doesn't work at all

1. Check if the project uses a dev preview page (`/dev/preview?component=...`) with built-in MSW handlers — prefer that over `page.route()`
2. Check `VITE_API_HOST` / `NEXT_PUBLIC_API_URL` env vars — if they point to an external host, use the full URL in `page.route()`
3. As last resort, create a test-specific environment config that points API calls to a localhost mock server
