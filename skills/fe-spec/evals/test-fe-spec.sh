#!/usr/bin/env bash
# Test: fe-spec skill behavioral rules
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
    prompt="다음은 fe-spec 스킬 문서 전체이다:

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

echo "=== Test: fe-spec skill ==="
echo ""

# Test 1: Figma + Code 두 입력 모드 지원
echo "Test 1: Figma과 코드 두 가지 입력 모드를 지원하는가..."
output=$(ask "이 스킬의 입력 모드는 몇 가지이며 각각 무엇인가?")
if assert_contains "$output" "Figma\|figma" "Figma 모드 언급"; then :; else exit 1; fi
if assert_contains "$output" "Code\|code\|코드" "Code 모드 언급"; then :; else exit 1; fi
echo ""

# Test 2: Spec 확인 전 분류 불가
echo "Test 2: spec 확인 없이 분류로 넘어갈 수 없는가..."
output=$(ask "interaction spec을 생성한 후 다음 단계로 넘어가기 전에 반드시 해야 하는 것은?")
if assert_contains "$output" "확인\|confirm\|STOP\|대기\|user" "user 확인 필요"; then :; else exit 1; fi
echo ""

# Test 3: 분류 결과
echo "Test 3: 분류 결과가 style-only와 interactive 두 가지인가..."
output=$(ask "복잡도 분류의 결과는 어떤 것들이 있는가?")
if assert_contains "$output" "style-only\|style only" "style-only 언급"; then :; else exit 1; fi
if assert_contains "$output" "interactive" "interactive 언급"; then :; else exit 1; fi
echo ""

# Test 4: 분류 확인 전 코드 작성 금지
echo "Test 4: 분류 확인 전 코드 작성이 금지되는가..."
output=$(ask "분류가 끝난 후 user 확인을 받기 전에 코드를 작성해도 되나?")
if assert_contains "$output" "안\|불가\|금지\|No\|no\|HARD.GATE\|않" "코드 작성 금지"; then :; else exit 1; fi
echo ""

echo "=== All fe-spec skill tests passed ==="
