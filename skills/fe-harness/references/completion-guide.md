# Phase 7 — Completion Guide

## Completion Report (MUST output to user)

When all workflows finish, output a structured summary. This is **mandatory** — never end with just "완료" or similar without this report.

```markdown
## Fe-Harness 완료 리포트

### Workflow A — Interaction TDD
- **분류**: <style-only | interactive> (style-only이면 "스킵됨" 표시)
- **테스트 파일**: `e2e/<task>.spec.ts`
- **결과**: <N>/<Total> 테스트 통과
- **TDD 사이클**: RED(<N>개 실패) → GREEN(<N>회 반복 후 전체 통과)
- **stall 발생**: <없음 | N회 — 원인: ...>

### Workflow B — Visual TDD
- **Visual Test List**: N개 항목
- **Figma 이미지**: `visual-qa/expected/` — N개 다운로드 완료
- **시각 비교 결과** (VT 항목마다 fe-visual-tdd Step 3 판정 블록을 그대로 포함 — PASS 한 줄만 쓰지 않음):
  - VT-1: [label] — PASS (N회 반복)
    - expected: `visual-qa/expected/<name>.png` / actual: `visual-qa/actual/<name>.png`
    - observed differences: `<위치> — <내용> → rendering noise | layout difference`, evidence: `<근거>` (없으면 none)
  - VT-2: ...
- **베이스라인 저장**: `__baselines__/<route>/<step>.png`

### 생성/수정된 파일
- `<file1>` — <설명>
- `<file2>` — <설명>
- ...

### 이슈 및 참고사항
- <특이사항, 스킵한 항목, 수동 확인 필요 사항 등. 없으면 "없음">
```

**Rules:**
- If a workflow was skipped (e.g., style-only skips Workflow A), still include it with "스킵됨" and the reason.
- If escalation happened (stall counter hit 3), include the failing test names and what was tried.
- Always list ALL created/modified files with brief descriptions.

---

## Artifacts that stay in the project

```
e2e/<task>.spec.ts              <- interaction tests (cumulative)
e2e/mocks/                      <- API mock data (reusable)
dev/preview/<Component>.tsx     <- preview routes (cumulative)
__baselines__/{route}/{step}.png <- structured baseline screenshots (commit)
visual-qa/config.json           <- per-task thresholds (commit)
playwright.config.ts            <- created once, permanent
```

> **Note:** Legacy projects may use `visual-qa/expected/` for baselines.
> New projects should use `__baselines__/{route}/{step}.png` for better organization.

## .gitignore additions

```
visual-qa/actual/
visual-qa/diff/
visual-qa/results/
```

## Regression: diff.ts for future changes

After baseline is established, future tasks can run:

```bash
npx tsx scripts/diff.ts \
  --expected __baselines__/<route>/<step>.png \
  --actual   visual-qa/actual/<task>.png \
  --diff     visual-qa/diff/<task>.png \
  --threshold 0.5 \
  --output-json visual-qa/results/<task>.json
```

This catches unintended visual regressions (browser vs browser = reliable).
Use `--output-json` to save results for CI scripting (PR comments, dashboards).
