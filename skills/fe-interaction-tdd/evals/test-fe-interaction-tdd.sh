#!/usr/bin/env bash
# Test: fe-interaction-tdd skill behavioral rules
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

TIMEOUT=60
SKILL_FILE="$SKILL_DIR/SKILL.md"

ask() {
    local question="$1"
    local outfile=$(mktemp)
    local prompt
    prompt="다음은 fe-interaction-tdd 스킬 문서 전체이다:

$(cat "$SKILL_FILE")

위 스킬 내용을 바탕으로 질문에 답해줘. 간결하게.
질문: $question"

    if perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" claude -p "$prompt" > "$outfile" 2>&1; then
        cat "$outfile"
    else
        cat "$outfile" >&2
    fi
    rm -f "$outfile"
}

echo "=== Test: fe-interaction-tdd skill ==="
echo ""

# Test 1: RED 확인 후 구현
echo "Test 1: RED 확인 없이 구현하면 안 되는가..."
output=$(ask "테스트를 작성한 후, 구현 코드를 작성하기 전에 반드시 해야 하는 것은?")
if assert_contains "$output" "RED\|fail\|실패\|red" "RED 확인 필요"; then :; else exit 1; fi
echo ""

# Test 2: 테스트 건너뛰기 불가
echo "Test 2: 테스트를 건너뛰고 바로 구현할 수 없는가..."
output=$(ask "spec이 있는 작업인데 테스트를 건너뛰고 바로 구현해도 되나?")
if assert_contains "$output" "안\|불가\|필수\|반드시\|No\|no\|must\|MUST\|없\|먼저" "테스트 필수"; then :; else exit 1; fi
echo ""

# Test 3: 독립 트리거 모드
echo "Test 3: spec 없이도 독립적으로 실행할 수 있는가..."
output=$(ask "이 스킬을 spec 없이 독립적으로 실행할 수 있나? 어떻게?")
if assert_contains "$output" "독립\|코드.*분석\|자체.*spec\|independent\|alone\|단독\|가능\|있" "독립 실행 가능"; then :; else exit 1; fi
echo ""

# Test 4: stall counter
echo "Test 4: stall counter가 3이면 멈추는가..."
output=$(ask "테스트 통과 수가 3번 연속 증가하지 않으면 어떻게 해야 하나?")
if assert_contains "$output" "escalate\|중단\|멈추\|stop\|human\|사용자\|알려" "escalate to human"; then :; else exit 1; fi
echo ""

# Test 5: Phase 분리
echo "Test 5: Phase 2와 Phase 4가 분리되어야 하는가..."
output=$(ask "Phase 2에서 구현 코드를 작성해도 되나?")
if assert_contains "$output" "안\|불가\|금지\|No\|no\|테스트.*만\|test.*only\|않" "구현 코드 금지"; then :; else exit 1; fi
echo ""

echo "=== All fe-interaction-tdd skill tests passed ==="
