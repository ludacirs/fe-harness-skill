# fe-harness Skill Issue Fixes — Design Spec

## Overview

Fix 7 reported issues in the fe-harness skill. Issues split into code fixes (1-3) and documentation strengthening (4-7).

---

## Issue 1+2: capture.ts — cwd & dependency resolution

**Problem:** capture.ts must be run via `cd ~/.claude/skills/fe-harness/scripts && NODE_PATH=... npx tsx capture.ts`, which changes cwd and breaks relative `--out` paths.

**Solution:**

1. **Fix dependency resolution via `createRequire`:** The existing `createRequire(import.meta.url)` already resolves from the script's location for the guard check. The dynamic `import('playwright')` on line 46 uses Node's standard ESM resolution which doesn't find the local node_modules. Fix: use `createRequire` to get the resolved path, then pass that to `import()`. Do NOT attempt to set `NODE_PATH` programmatically — it has no effect on ESM `import()` after the module resolver is initialized.

   ```typescript
   const require = createRequire(import.meta.url);
   const playwrightPath = require.resolve('playwright');
   const { chromium } = await import(playwrightPath);
   ```

2. **Relative path resolution:** With the `cd` removed from the invocation, `process.cwd()` is already the caller's project directory. Relative `--out`, `--steps`, `--mock-routes` paths will resolve correctly against `process.cwd()` without any special handling. Add `ORIGINAL_CWD` as an optional safety net for edge cases where the cwd might differ (e.g., wrapper scripts). If set, resolve relative paths against it; otherwise fall back to `process.cwd()`.

3. **Update SKILL.md commands:** Change from `cd scripts && NODE_PATH=... npx tsx capture.ts` to `npx tsx ~/.claude/skills/fe-harness/scripts/capture.ts` (no `cd`, no `NODE_PATH`, no `ORIGINAL_CWD` in the default invocation).

**Changes:**
- `scripts/capture.ts`: Use `createRequire` for playwright import; add `ORIGINAL_CWD` fallback for path resolution; apply to `--out`, `--steps`, `--mock-routes`
- `SKILL.md`: Update all capture.ts invocation examples (remove `cd` and `NODE_PATH`)

**Verification:** Run `npx tsx ~/.claude/skills/fe-harness/scripts/capture.ts --url http://example.com --out visual-qa/actual/test.png` from a project root directory. Verify the file lands in `<project-root>/visual-qa/actual/test.png`.

---

## Issue 3: figma-export.ts — token validation

**Problem:** Expired/invalid tokens pass format check (`figd_` prefix) but fail at API call time, wasting time.

**Solution:** After format validation, call `GET https://api.figma.com/v1/me` with the token. Discriminate response codes:
- **401/403:** Token is invalid or expired. Print error with regeneration URL and exit.
- **5xx:** Figma API may be temporarily unavailable. Print warning but do NOT tell user to regenerate token. Exit with suggestion to retry.
- **200:** Token is valid, proceed.

**Changes:**
- `scripts/figma-export.ts`: Add `validateToken()` function after format check, before main API call

**Verification:** Run figma-export.ts with an expired token. Verify the error message appears before any image request is made.

---

## Issue 4: diff.ts misuse prevention

**Problem:** Agents attempt to use diff.ts for Figma-vs-browser comparison despite the header warning.

**Solution:** Strengthen SKILL.md with a NEVER rule in the Visual TDD section. The existing diff.ts header comment is sufficient for the script itself.

**Changes:**
- `SKILL.md`: Add explicit NEVER rule in PHASE 4 Step 3

---

## Issue 5: TDD loop enforcement (RED -> GREEN)

**Problem:** Agents skip RED confirmation or GREEN confirmation, jumping straight to implementation or Visual TDD.

**Solution:** Add hard gates as MUST/NEVER rules with explicit checkpoint markers using this format:

```
>>> HARD GATE: Do NOT proceed past this point until [condition] is confirmed. <<<
```

Gate locations:
- After PHASE 2 Step 3 (RED confirmation): "Do NOT proceed to implementation until ALL tests have been run and confirmed FAILING."
- After PHASE 2 Step 4 (GREEN confirmation): "Do NOT proceed to Workflow B until ALL interaction tests PASS. Run `npx playwright test` and confirm 0 failures."

**Changes:**
- `SKILL.md` PHASE 2: Add hard gate blocks at Step 3 (RED) and after Step 4 (GREEN)

---

## Issue 6: Visual TDD capture checklist

**Problem:** Agents capture only some Figma nodes, missing modal states, alternate views, etc.

**Solution:** Add "Step 0: Enumerate Capture Targets" at the start of PHASE 3. This step uses information already gathered in PHASE 0 (not additional MCP calls) to build the list. This preserves the "Workflow B does NOT use Figma MCP" rule.

The enumeration step:
1. List all Figma nodes gathered in PHASE 0 (frames, variants, modal states)
2. Define capture scenario for each node (default state, hover, open modal, etc.)
3. Present list to user for confirmation before proceeding
4. Track as checklist — all items must be captured before Visual TDD is complete

**Changes:**
- `SKILL.md`: Insert Step 0 at start of PHASE 3; update Workflow B checklist

---

## Issue 7: API mock troubleshooting guide

**Problem:** `page.route()` doesn't intercept requests to external hosts. No guidance on common pitfalls.

**Solution:** Add troubleshooting subsection to PHASE 2 Step 2 covering:
- **`page.route('**/api/...')` does NOT match absolute external URLs.** Must use full URL pattern: `page.route('https://api.example.com/users', ...)` for external hosts.
- External host requests (e.g., `VITE_API_HOST=http://172.168.x.x`) bypass Playwright's network layer in some configurations.
- If project has a dev preview page, prefer using it with built-in MSW handlers over `page.route()`.
- Verify mocks are active: check Playwright test output for `[mock] N route(s) intercepted` log.

**Changes:**
- `SKILL.md` PHASE 2 Step 2: Add troubleshooting subsection

---

## Files Modified

| File | Issues Addressed |
|------|-----------------|
| `scripts/capture.ts` | #1, #2 |
| `scripts/figma-export.ts` | #3 |
| `SKILL.md` | #4, #5, #6, #7 |

## Out of Scope

- No wrapper scripts or bin/ directory (over-engineering)
- No SSIM mode for diff.ts (Figma vs browser comparison stays with Claude vision)
- No changes to diff.ts code (header warning is sufficient, SKILL.md gets the enforcement)
- figma-export.ts `--out` path resolution: not affected because SKILL.md already invokes it without `cd`, so `process.cwd()` is correct. If a future issue arises, the same `ORIGINAL_CWD` pattern can be applied.
- Backward compatibility: skill updates take effect on next invocation; no persistent state from old invocation format.
