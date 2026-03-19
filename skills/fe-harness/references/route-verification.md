# Actual Route Verification (Step 4-b)

After ALL preview-based visual tests pass, also capture the **actual
production route** if it can be accessed (e.g., via MSW mock mode or
seeded auth). Compare the actual route screenshot against the preview
screenshot to detect drift. If they differ significantly, the preview
was not constructed correctly — it likely duplicates markup instead of
importing real components. Fix the preview before proceeding.

## Capture

```bash
npx tsx scripts/capture.ts \
  --url  http://localhost:<PORT>/<actual-route> \
  --out  visual-qa/actual/<target-name>-route.png \
  --type page \
  --width <W> --height <H>
```

## Compare

Compare `visual-qa/actual/<target-name>.png` (preview) against
`visual-qa/actual/<target-name>-route.png` (actual route) using Claude
visual comparison. If the two diverge, the preview is not representative.

## When to skip

Skip this step only if the actual route is inaccessible (e.g.,
requires real auth, external services, or data that cannot be mocked).
