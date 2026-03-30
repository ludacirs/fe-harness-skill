#!/usr/bin/env bash
# Test: fe-visual-tdd skill behavioral rules
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
    prompt="다음은 fe-visual-tdd 스킬 문서 전체이다:

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

echo "=== Test: fe-visual-tdd skill ==="
echo ""

# Test 1: Figma MCP 사용 금지
echo "Test 1: Figma MCP를 사용하지 않는가..."
output=$(ask "이 스킬에서 Figma 이미지를 가져올 때 어떤 방법을 쓰나? MCP인가 REST API인가?")
if assert_contains "$output" "REST\|rest\|figma-export\|API\|api" "REST API 사용"; then :; else exit 1; fi
echo ""

# Test 2: Baseline 모드 지원
echo "Test 2: Figma 없이도 동작하는가..."
output=$(ask "Figma URL이 없을 때 이 스킬은 어떻게 동작하나?")
if assert_contains "$output" "baseline\|Baseline\|캡처\|capture\|저장" "baseline 모드"; then :; else exit 1; fi
echo ""

# Test 3: 모든 VT 항목 완료 필요
echo "Test 3: 일부 VT 항목만 통과하면 완료 선언할 수 있는가..."
output=$(ask "Visual Test List의 5개 항목 중 3개만 통과했다. 완료를 선언해도 되나?")
if assert_contains "$output" "안\|불가\|모든\|전부\|all\|ALL\|No\|no" "전부 통과 필요"; then :; else exit 1; fi
echo ""

# Test 4: diff.ts는 Figma 비교에 사용하지 않음
echo "Test 4: diff.ts를 Figma vs 브라우저 비교에 사용하지 않는가..."
output=$(ask "Figma expected 이미지와 브라우저 캡처를 비교할 때 diff.ts를 써도 되나?")
if assert_contains "$output" "안\|불가\|금지\|No\|no\|Claude\|claude\|vision\|않" "diff.ts 사용 금지"; then :; else exit 1; fi
echo ""

# Test 5: stall counter
echo "Test 5: stall counter가 3이면 멈추는가..."
output=$(ask "visual verification에서 3번 연속 진전이 없으면 어떻게 해야 하나?")
if assert_contains "$output" "escalate\|중단\|멈추\|stop\|human\|사용자\|알려" "escalate to human"; then :; else exit 1; fi
echo ""

echo "=== All fe-visual-tdd skill tests passed ==="
