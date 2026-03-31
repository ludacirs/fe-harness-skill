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
    prompt="Below is the full fe-harness orchestrator skill document:

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

echo "=== Test: fe-harness orchestrator skill ==="
echo ""

# Test 1: Skill invocation order
echo "Test 1: Understands correct skill invocation order..."
output=$(ask "List the skills this orchestrator invokes, in order.")
if assert_contains "$output" "fe-spec\|fe.spec" "Mentions fe-spec"; then :; else exit 1; fi
if assert_contains "$output" "fe-interaction-tdd\|fe.interaction" "Mentions fe-interaction-tdd"; then :; else exit 1; fi
if assert_contains "$output" "fe-visual-tdd\|fe.visual" "Mentions fe-visual-tdd"; then :; else exit 1; fi
echo ""

# Test 2: style-only skips interaction-tdd
echo "Test 2: style-only classification skips fe-interaction-tdd..."
output=$(ask "For a task classified as style-only, does the orchestrator invoke fe-interaction-tdd?")
if assert_contains "$output" "skip\|Skip\|not\|No\|no\|only.*visual\|does not" "Skips interaction-tdd"; then :; else exit 1; fi
echo ""

# Test 3: Invokes verification
echo "Test 3: Invokes superpowers verification after completion..."
output=$(ask "After all skills finish, which superpowers skill is invoked first?")
if assert_contains "$output" "verification\|Verification" "Invokes verification"; then :; else exit 1; fi
echo ""

# Test 4: Invokes finishing
echo "Test 4: Invokes finishing after verification..."
output=$(ask "Which superpowers skill is invoked after verification?")
if assert_contains "$output" "finishing\|Finishing\|development.branch" "Invokes finishing"; then :; else exit 1; fi
echo ""

echo "=== All fe-harness orchestrator skill tests passed ==="
