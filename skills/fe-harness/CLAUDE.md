# fe-harness

프론트엔드 UI 작업용 스킬 모음.

## 스킬 구조

| 스킬 | 역할 | 독립 트리거 |
|------|------|------------|
| `fe-spec` | 컨텍스트 수집 + spec 생성 + 분류 | "이 디자인 spec 만들어줘" |
| `fe-interaction-tdd` | e2e 테스트 → RED → GREEN | "이 페이지에 e2e 추가해줘" |
| `fe-visual-tdd` | 스크린샷 캡처 → 비교 → baseline | "visual baseline 잡아줘" |
| `fe-harness` | 오케스트레이터 (풀 플로우) | "이 Figma 구현해줘" |

## Frontend Skill Routing

프론트엔드 UI 작업(컴포넌트 구현, 페이지 구현, 스타일 변경, Figma 디자인 구현)의
TDD는 superpowers test-driven-development 대신 fe-harness 스킬을 사용할 것.

## 테스트

```bash
cd evals
bash run-all.sh
```

SKILL.md 수정 후 반드시 테스트를 돌려서 기존 규칙이 깨지지 않았는지 확인할 것.
