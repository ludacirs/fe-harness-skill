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
    prompt="Below is the full fe-visual-tdd skill document:

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

first_line() {
    echo "$1" | grep -v '^Warning: no stdin' | grep -v '^[[:space:]]*$' | head -1
}

echo "=== Test: fe-visual-tdd skill ==="
echo ""

# Test 1: No Figma MCP for image download
echo "Test 1: Does not use Figma MCP for image download..."
output=$(ask "How does this skill download Figma images — MCP or REST API?")
if assert_contains "$output" "REST\|rest\|figma-export\|API\|api" "Uses REST API"; then :; else exit 1; fi
echo ""

# Test 2: Baseline mode support
echo "Test 2: Works without Figma..."
output=$(ask "How does this skill work when there is no Figma URL?")
if assert_contains "$output" "baseline\|Baseline\|capture\|Capture\|save" "Baseline mode"; then :; else exit 1; fi
echo ""

# Test 3: All VT items must pass
echo "Test 3: Cannot declare complete with partial VT items..."
output=$(ask "If 3 out of 5 Visual Test List items pass, can I declare completion?")
if assert_contains "$output" "No\|no\|not\|cannot\|all\|ALL\|every\|must" "All must pass"; then :; else exit 1; fi
echo ""

# Test 4: diff.ts not for Figma comparison
echo "Test 4: diff.ts is not used for Figma vs browser comparison..."
output=$(ask "Can I use diff.ts to compare the Figma expected image with the browser screenshot?")
if assert_contains "$output" "No\|no\|not\|cannot\|Claude\|claude\|vision\|never\|unreliable" "diff.ts prohibited for Figma"; then :; else exit 1; fi
echo ""

# Test 5: Stall counter
echo "Test 5: Stops at stall counter 3..."
output=$(ask "What happens if visual verification makes no progress for 3 consecutive iterations?")
if assert_contains "$output" "escalate\|stop\|human\|user\|ask" "Escalates to human"; then :; else exit 1; fi
echo ""

# Test 6: Visual verdict must carry evidence (issue #48)
echo "Test 6: Per-VT verdict includes observed differences and evidence..."
output=$(ask "After Claude visually compares a VT item's expected and actual images and decides it passes, what exactly must the report to the user contain for that VT item?")
if assert_contains "$output" "evidence\|Evidence\|observed\|Observed\|classif" "Verdict includes evidence"; then :; else exit 1; fi
echo ""

# Test 7: Measure instead of eyeballing (issue #48)
echo "Test 7: Suspected spacing difference is measured, not eyeballed..."
output=$(ask "During visual comparison, the title looks a few pixels lower than in Figma but I am not sure. What should I do?")
if assert_contains "$output" "getBoundingClientRect\|get_metadata\|bounding" "Measures geometry"; then :; else exit 1; fi
echo ""

# Test 8: Classic mode keeps the VT list STOP (regression)
echo "Test 8: Default mode still stops to confirm the Visual Test List..."
output=$(ask "In the default mode (not checkpoint mode), Figma mode: do you stop for the user to confirm the Visual Test List before downloading images? Start with Yes or No.")
if assert_contains "$(first_line "$output")" "^Yes\\|^\\*\\*Yes" "Classic VT list STOP kept"; then :; else exit 1; fi
echo ""

# Test 9: Checkpoint mode skips the VT list STOP
echo "Test 9: Checkpoint mode does not stop for the VT list..."
output=$(ask "In checkpoint mode, Figma mode: do you stop for the user to confirm the Visual Test List before downloading images? Start with Yes or No, then say why.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "No VT list STOP"; then :; else exit 1; fi
if assert_contains "$output" "plan" "Already approved in the checkpoint plan"; then :; else exit 1; fi
echo ""

# Test 10: Checkpoint mode processes only the CP's VT items
echo "Test 10: Checkpoint mode processes only this checkpoint's VT items..."
output=$(ask "In checkpoint mode, the spec has VT-1, VT-2, VT-3 and the current checkpoint CP-2 lists only VT-2. How many VT items do you capture and compare now? Answer with a number first.")
if assert_contains "$(first_line "$output")" "^1\\|^\\*\\*1\\|^One\\|^\\*\\*One" "Only the CP's VT item"; then :; else exit 1; fi
echo ""

# Test 11: Checkpoint mode returns verdict blocks instead of the final STOP
echo "Test 11: Checkpoint mode returns verdict blocks instead of stopping..."
output=$(ask "In checkpoint mode, all of the checkpoint's VT items pass. Do you stop and wait for the user to confirm the visual results? Start with Yes or No, then say what you do instead.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "No final STOP"; then :; else exit 1; fi
if assert_contains "$output" "verdict" "Returns verdict blocks"; then :; else exit 1; fi
echo ""

echo "=== All fe-visual-tdd skill tests passed ==="
