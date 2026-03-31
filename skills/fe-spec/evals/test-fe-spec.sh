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
    prompt="Below is the full fe-spec skill document:

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

echo "=== Test: fe-spec skill ==="
echo ""

# Test 1: Supports both Figma and Code input modes
echo "Test 1: Does it support both Figma and Code input modes..."
output=$(ask "How many input modes does this skill have and what are they?")
if assert_contains "$output" "Figma\|figma" "Mentions Figma mode"; then :; else exit 1; fi
if assert_contains "$output" "Code\|code" "Mentions Code mode"; then :; else exit 1; fi
echo ""

# Test 2: Cannot proceed to classification without spec confirmation
echo "Test 2: Cannot proceed to classification without spec confirmation..."
output=$(ask "After generating the interaction spec, what must happen before moving to the next step?")
if assert_contains "$output" "confirm\|STOP\|wait\|user\|approval" "Requires user confirmation"; then :; else exit 1; fi
echo ""

# Test 3: Classification results
echo "Test 3: Classification results include style-only and interactive..."
output=$(ask "What are the possible complexity classification results?")
if assert_contains "$output" "style-only\|style only" "Mentions style-only"; then :; else exit 1; fi
if assert_contains "$output" "interactive" "Mentions interactive"; then :; else exit 1; fi
echo ""

# Test 4: No code before classification confirmation
echo "Test 4: No code allowed before classification is confirmed..."
output=$(ask "Can I write code before the user confirms the classification?")
if assert_contains "$output" "No\|no\|not\|cannot\|must not\|HARD.GATE\|never" "Code writing prohibited"; then :; else exit 1; fi
echo ""

echo "=== All fe-spec skill tests passed ==="
