#!/usr/bin/env bash
# Shared test helpers for fe-harness skill evals

assert_contains() {
    local output="$1"
    local pattern="$2"
    local label="$3"

    if echo "$output" | grep -q "$pattern"; then
        echo "  ✅ $label"
        return 0
    else
        echo "  ❌ $label — pattern not found: $pattern"
        echo "     Output was: $output"
        return 1
    fi
}
