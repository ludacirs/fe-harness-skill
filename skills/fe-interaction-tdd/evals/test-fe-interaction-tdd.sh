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
    prompt="Below is the full fe-interaction-tdd skill document:

$(cat "$SKILL_FILE")

Based on the skill document above, answer the question concisely in English.
Question: $question"

    if perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" claude -p "$prompt" > "$outfile" 2>&1; then
        cat "$outfile"
    else
        cat "$outfile" >&2
    fi
    rm -f "$outfile"
}

echo "=== Test: fe-interaction-tdd skill ==="
echo ""

# Test 1: Must confirm RED before implementation
echo "Test 1: Must confirm RED before writing implementation code..."
output=$(ask "After writing tests, what must happen before writing implementation code?")
if assert_contains "$output" "RED\|fail\|red\|run.*test" "RED confirmation required"; then :; else exit 1; fi
echo ""

# Test 2: Cannot skip tests
echo "Test 2: Cannot skip tests and jump straight to implementation..."
output=$(ask "Given a task with a spec, can I skip writing tests and go straight to implementation?")
if assert_contains "$output" "No\|no\|not\|cannot\|must\|never\|required\|first" "Tests are required"; then :; else exit 1; fi
echo ""

# Test 3: Independent trigger mode
echo "Test 3: Can run independently without a spec..."
output=$(ask "Can this skill run independently without a spec? How?")
if assert_contains "$output" "independent\|without.*spec\|code.*analy\|self.*generate\|yes\|Yes" "Independent execution possible"; then :; else exit 1; fi
echo ""

# Test 4: Stall counter
echo "Test 4: Stops at stall counter 3..."
output=$(ask "What happens if the number of passing tests doesn't increase for 3 consecutive runs?")
if assert_contains "$output" "escalate\|stop\|human\|user\|guidance\|ask" "Escalates to human"; then :; else exit 1; fi
echo ""

# Test 5: Phase separation
echo "Test 5: Phase 2 and Phase 4 must be separate..."
output=$(ask "Can I write implementation code during Phase 2?")
if assert_contains "$output" "No\|no\|not\|cannot\|forbidden\|test.*only\|never\|prohibited" "Implementation code prohibited"; then :; else exit 1; fi
echo ""

# Test 6: State fixture catalog is read before writing mocks
echo "Test 6: Reads the state fixture catalog before writing API mocks..."
output=$(ask "A test needs the API to return 'user who finished the diagnosis'. Before writing any mock data, which directory must you check first? Answer with the path.")
if assert_contains "$output" "e2e/fixtures/states" "Checks e2e/fixtures/states first"; then :; else exit 1; fi
echo ""

# Test 7: Response bodies live in state fixtures, not inline in spec files
echo "Test 7: Does not inline API response bodies in the spec file..."
output=$(ask "The project has no MSW. May the spec file contain an inline JSON response body, e.g. route.fulfill({ body: JSON.stringify({ id: 1, name: 'Jane' }) })? Start your answer with Yes or No, then say where the response body goes.")
if assert_contains "$output" "^No\|^\*\*No" "Inline response body not allowed"; then :; else exit 1; fi
if assert_contains "$output" "fixtures/states" "Response body goes to a state fixture"; then :; else exit 1; fi
echo ""

echo "=== All fe-interaction-tdd skill tests passed ==="
