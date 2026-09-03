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

echo "=== All fe-visual-tdd skill tests passed ==="
