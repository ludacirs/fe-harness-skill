#!/usr/bin/env bash
# Run all tests for this skill
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Running Tests ==="
echo ""

PASSED=0
FAILED=0
RESULTS=()

for test_file in "$SCRIPT_DIR"/test-*.sh; do
    [ "$(basename "$test_file")" = "test-helpers.sh" ] && continue

    test_name=$(basename "$test_file" .sh)
    echo "Running: $test_name"

    LOG="/tmp/fe-skill-$test_name.log"
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
