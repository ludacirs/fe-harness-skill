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

first_line() {
    echo "$1" | grep -v '^Warning: no stdin' | grep -v '^[[:space:]]*$' | head -1
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

# Test 5: Checkpoint mode human STOPs are plan approval + one per checkpoint
echo "Test 5: Checkpoint mode stops once for the plan and once per checkpoint..."
output=$(ask "In checkpoint mode, a task is planned as 4 checkpoints and every checkpoint is approved on the first try. Counting from fe-spec until the last checkpoint is committed, how many times does the user confirm something? Answer with a number first, then list them.")
if assert_contains "$(first_line "$output")" "^5\|^\*\*5\|^Five\|^\*\*Five" "1 plan + 4 checkpoint approvals"; then :; else exit 1; fi
echo ""

# Test 6: RED is not a human STOP in checkpoint mode
echo "Test 6: Checkpoint mode does not ask the user to confirm RED..."
output=$(ask "In checkpoint mode, does the user confirm RED for each checkpoint before implementation starts? Start with Yes or No, then say what replaces it.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "No RED STOP"; then :; else exit 1; fi
if assert_contains "$output" "evidence" "Evidence block replaces it"; then :; else exit 1; fi
echo ""

# Test 7: No commit without G5 approval
echo "Test 7: Cannot commit a checkpoint without user approval..."
output=$(ask "In checkpoint mode, CP-2 is GREEN and the build passes. May you commit CP-2 and start CP-3 without asking the user? Start with Yes or No.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "Commit requires approval"; then :; else exit 1; fi
echo ""

# Test 8: Unmet evidence condition stops the loop
echo "Test 8: Unmet evidence condition hands control to the user..."
output=$(ask "In checkpoint mode, the RED evidence for CP-3 cannot be satisfied: one new test keeps passing before implementation. May you continue to implementation anyway? Start with Yes or No, then say what happens.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "Does not continue"; then :; else exit 1; fi
if assert_contains "$output" "user\|escalat\|human\|to you" "Hands to user"; then :; else exit 1; fi
echo ""

# Test 9: Review gate runs between GREEN and G5
echo "Test 9: Two independent reviewers run before the checkpoint report..."
output=$(ask "In checkpoint mode, CP-2 just reached GREEN. What happens before the G5 checkpoint report? Name the reviewers.")
if assert_contains "$output" "spec fidelity\|Spec fidelity\|Reviewer A\|reviewer A" "Spec fidelity reviewer"; then :; else exit 1; fi
if assert_contains "$output" "maintainab\|Maintainab\|Reviewer B\|reviewer B" "Maintainability reviewer"; then :; else exit 1; fi
echo ""

# Test 10: Findings cannot be dismissed without a reason
echo "Test 10: A review finding cannot be dropped without a grounded reason..."
output=$(ask "In checkpoint mode, reviewer A flags a hardcoded value in CP-2. You think it is fine. May you leave it out of the G5 report without fixing it or writing a reason? Start with Yes or No.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "Cannot silently drop"; then :; else exit 1; fi
echo ""

# Test 11: Fixing a finding re-runs GREEN
echo "Test 11: After fixing a review finding, GREEN is re-confirmed..."
output=$(ask "In checkpoint mode, you fixed reviewer B's finding in CP-2. May you go straight to the G5 report? Start with Yes or No, then say what comes first.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "Not straight to G5"; then :; else exit 1; fi
if assert_contains "$output" "GREEN\|G2" "Re-run from G2/GREEN"; then :; else exit 1; fi
echo ""

# Test 12: Review round limit
echo "Test 12: Review rounds per checkpoint are capped at 2..."
output=$(ask "In checkpoint mode, what is the maximum number of review rounds for one checkpoint before it is handed to the user? Answer with a number first.")
if assert_contains "$(first_line "$output")" "^2\\|^\\*\\*2\\|^Two\\|^\\*\\*Two" "Cap is 2"; then :; else exit 1; fi
echo ""

# Test 13: Visual comparison runs per checkpoint
echo "Test 13: fe-visual-tdd runs once per checkpoint that has VT items..."
output=$(ask "In checkpoint mode, a task has 4 checkpoints; only CP-2 and CP-3 have VT items. How many times is fe-visual-tdd invoked in total? Answer with a number first.")
if assert_contains "$(first_line "$output")" "^2\\|^\\*\\*2\\|^Two\\|^\\*\\*Two" "Once per CP with VT items"; then :; else exit 1; fi
echo ""

# Test 14: G5 change requests are recorded as lessons
echo "Test 14: A G5 change request is recorded in the lessons file..."
output=$(ask "In checkpoint mode, at G5 the user requests changes: 'use the shared EmptyState component, not a custom div'. Besides redoing the checkpoint from G2, which file do you update? Give the path.")
if assert_contains "$output" ".fe-harness/lessons.md" "Updates .fe-harness/lessons.md"; then :; else exit 1; fi
echo ""

# Test 15: Repeated lessons are counted, not duplicated
echo "Test 15: A repeated lesson increments its count instead of adding a line..."
output=$(ask "In checkpoint mode, a fixed review finding matches a rule already in the lessons file. Do you add a new line for it? Start with Yes or No, then say what you do.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "No duplicate line"; then :; else exit 1; fi
if assert_contains "$output" "count\|Count" "Increments the count"; then :; else exit 1; fi
echo ""

# Test 16: Lessons are never moved into CLAUDE.md directly
echo "Test 16: Lessons are suggested for CLAUDE.md, never moved directly..."
output=$(ask "In checkpoint mode, a lesson has been recorded 4 times. May you add it to the repository's CLAUDE.md yourself? Start with Yes or No, then say what you do.")
if assert_contains "$(first_line "$output")" "^No\\|^\\*\\*No" "Does not edit CLAUDE.md"; then :; else exit 1; fi
if assert_contains "$output" "completion report\|suggest\|propos" "Suggests in completion report"; then :; else exit 1; fi
echo ""

echo "=== All fe-harness orchestrator skill tests passed ==="
