#!/usr/bin/env bash
# Test: fe-harness orchestrator skill behavioral rules
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
    prompt="다음은 fe-harness 오케스트레이터 스킬 문서 전체이다:

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

echo "=== Test: fe-harness orchestrator skill ==="
echo ""

# Test 1: 스킬 호출 순서
echo "Test 1: 스킬 호출 순서를 올바르게 이해하는가..."
output=$(ask "이 오케스트레이터가 호출하는 스킬을 순서대로 나열해줘.")
if assert_contains "$output" "fe-spec\|fe.spec" "fe-spec 언급"; then :; else exit 1; fi
if assert_contains "$output" "fe-interaction-tdd\|fe.interaction" "fe-interaction-tdd 언급"; then :; else exit 1; fi
if assert_contains "$output" "fe-visual-tdd\|fe.visual" "fe-visual-tdd 언급"; then :; else exit 1; fi
echo ""

# Test 2: style-only 분류 시 interaction-tdd 스킵
echo "Test 2: style-only일 때 fe-interaction-tdd를 건너뛰는가..."
output=$(ask "style-only로 분류된 작업에서 fe-interaction-tdd를 호출하나?")
if assert_contains "$output" "건너\|스킵\|skip\|않\|안\|No\|no\|visual.*만\|only" "interaction-tdd 스킵"; then :; else exit 1; fi
echo ""

# Test 3: verification 호출
echo "Test 3: 완료 후 superpowers verification을 호출하는가..."
output=$(ask "모든 스킬이 끝난 후 어떤 superpowers 스킬을 호출하나?")
if assert_contains "$output" "verification\|Verification" "verification 호출"; then :; else exit 1; fi
echo ""

# Test 4: finishing 호출
echo "Test 4: verification 후 finishing을 호출하는가..."
output=$(ask "verification 후에 호출하는 superpowers 스킬은?")
if assert_contains "$output" "finishing\|Finishing\|development.branch" "finishing 호출"; then :; else exit 1; fi
echo ""

echo "=== All fe-harness orchestrator skill tests passed ==="
