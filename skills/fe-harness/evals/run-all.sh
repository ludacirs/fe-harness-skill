#!/usr/bin/env bash
# Run ALL fe-harness ecosystem tests (all 4 skills)
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Running ALL fe-harness ecosystem tests ==="
echo ""

PASSED=0
FAILED=0
RESULTS=()

for skill_dir in fe-spec fe-interaction-tdd fe-visual-tdd fe-harness; do
    eval_dir="$SKILLS_DIR/$skill_dir/evals"
    [ ! -d "$eval_dir" ] && continue

    for test_file in "$eval_dir"/test-*.sh; do
        [ "$(basename "$test_file")" = "test-helpers.sh" ] && continue

        test_name="$skill_dir/$(basename "$test_file" .sh)"
        echo "Running: $test_name"

        LOG="/tmp/fe-harness-$skill_dir-$(basename "$test_file" .sh).log"
        if bash "$test_file" > "$LOG" 2>&1; then
            PASSED=$((PASSED + 1))
            RESULTS+=("✅ $test_name")
        else
            FAILED=$((FAILED + 1))
            RESULTS+=("❌ $test_name")
        fi
        cat "$LOG"

        echo ""
        echo "---"
        echo ""
    done
done

echo "=== Summary ==="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
