# fe-harness

프론트엔드 개발을 위한 [Claude Code 스킬](https://agentskills.io) 모음.
**Interaction TDD** (Playwright 테스트)와 **Visual Verification** (Figma 비교)
두 가지 피드백 루프를 제공합니다.

AI 에이전트는 코드와 테스트를 동시에 작성하기 때문에 유닛 테스트가 신뢰할 수 있는
게이트가 되지 못합니다. 이 스킬은 Figma + 작업 설명에서 interaction spec을 생성하고,
구현 *전에* Playwright 테스트를 작성하여(진짜 RED 신호) 이 문제를 해결합니다.
이후 Figma 디자인과의 시각적 일치를 검증합니다.

지원 환경: Claude Code, Cursor, Codex, OpenCode, 그리고
[Agent Skills 스펙](https://agentskills.io)을 지원하는 모든 에이전트.

## 설치

> **프로젝트 레벨로만 설치하세요.** 글로벌 설치하면 안 됩니다.
> 스킬이 프로젝트 루트 기준 `skills/` 경로를 참조하므로
> 글로벌 설치 시 스크립트 실행이 깨집니다.

```bash
npx skills add ludacirs/fe-harness-skill
```

최초 1회 셋업을 실행하여 Playwright와 Chromium을 설치하세요:

```bash
cd skills/fe-harness/scripts
npm run setup
```

## 스킬 구성

fe-harness는 개별 트리거가 가능한 4개의 독립 스킬로 구성되어 있습니다.

| 스킬 | 역할 | 트리거 예시 |
|------|------|------------|
| **fe-spec** | 컨텍스트 수집 + spec 생성 + 복잡도 분류 | "이 디자인 spec 만들어줘", "이 컴포넌트 분석해줘" |
| **fe-interaction-tdd** | Playwright e2e 테스트 → RED → GREEN | "이 페이지에 e2e 테스트 추가해줘", "이 컴포넌트 테스트 작성해줘" |
| **fe-visual-tdd** | 스크린샷 캡처 → Figma 비교 → baseline | "visual baseline 잡아줘", "Figma랑 스크린샷 비교해줘" |
| **fe-harness** | 오케스트레이터 (풀 플로우) | "이 Figma 디자인 구현해줘", "이 컴포넌트 만들어줘" |

### 풀 플로우 (fe-harness 오케스트레이터)

```
fe-spec                     컨텍스트 & Spec & 분류
  ↓ [사용자가 spec 확인]
  ↓ [사용자가 분류 확인]
  ↓
  ├── style-only ──────────→ fe-visual-tdd
  │                            ↓
  └── interactive ──────────→ fe-interaction-tdd → fe-visual-tdd
                                                      ↓
                              완료 리포트 ←────────────┘
                                ↓
                              superpowers verification-before-completion
                                ↓
                              superpowers finishing-a-development-branch
```

### 개별 사용

각 스킬은 독립적으로 동작합니다:

- **fe-spec만** — Figma 또는 기존 코드에서 spec만 생성 (구현 없음)
- **fe-interaction-tdd만** — 기존 코드에 e2e 테스트 추가 (코드 분석 → spec 생성 → 테스트 작성 → RED → GREEN)
- **fe-visual-tdd만** — Figma 없이 visual baseline 캡처 (baseline 모드) 또는 Figma와 비교

### superpowers 통합

fe-harness는 [superpowers](https://github.com/obra/superpowers)와 함께 사용하도록 설계되었습니다.
프론트엔드 UI 작업에서 superpowers의 `test-driven-development` 스킬을 대체합니다.
프로젝트의 `CLAUDE.md`에 다음을 추가하여 라우팅을 활성화하세요:

```markdown
For frontend UI work (component/page implementation, style changes, Figma design
implementation), use fe-harness skills instead of superpowers test-driven-development.
```

## 주요 기능

- **이중 입력 모드** — Figma URL 또는 기존 코드에서 시작
- **AI spec 생성** — Figma 디자인 + 작업 설명에서 interaction spec 합성, 불분명할 때 사용자에게 질문
- **Interaction TDD** — 구현 전에 Playwright 테스트 작성, 진짜 RED/GREEN 게이트
- **Visual verification** — Claude가 Figma 스크린샷과 브라우저 렌더링을 비교 (픽셀 diff 아님)
- **Regression** — `diff.ts` (pixelmatch)로 baseline 이후 browser-to-browser 비교
- **API 모킹** — MSW 감지 또는 `page.route()` 폴백; capture.ts용 `--mock-routes`
- **하네스 축적** — 테스트, preview 라우트, baseline이 프로젝트에 영구 인프라로 남음
- **정체 감지** — 진전이 없으면 (3회 연속 미개선) 중단하고 사용자에게 에스컬레이션
- **STOP 게이트** — 각 Phase마다 사용자의 명시적 확인이 필요

## 스크립트

| 스크립트 | 용도 |
|----------|------|
| `capture.ts` | Playwright 스크린샷 (컴포넌트 / 페이지 / 플로우) |
| `diff.ts` | pixelmatch 비교 — **regression 전용** (browser vs browser) |
| `figma-export.ts` | Figma REST API로 프레임 이미지 다운로드 |

모든 스크립트는 `--help`로 사용법을 확인할 수 있습니다.

## Evals

각 스킬에 STOP 게이트, Phase 분리, 규칙 준수를 검증하는 동작 테스트가 있습니다:

```bash
# 전체 스킬 테스트 실행
cd skills/fe-harness/evals
bash run-all.sh

# 개별 스킬 테스트 실행
cd skills/fe-spec/evals
bash run-all.sh
```

## 요구사항

- Node.js 18+
- Figma Personal Access Token (`figd_*`) — 디자인 내보내기용
- Figma MCP 연결 — 디자인 spec 조회용
