#!/bin/bash
# check-expected-images.sh — Gate script for Phase 0
# Verifies that figma-export.ts has been run and expected images exist on disk.
# Exit 0 = images found, Exit 1 = no images (blocks spec generation).

DIR="${1:-visual-qa/expected}"

if [ ! -d "$DIR" ]; then
  echo ""
  echo "============================================================"
  echo "[GATE FAILED] Directory '$DIR' does not exist."
  echo ""
  echo "You have NOT run figma-export.ts yet."
  echo "Go back to Step 0-1 and run:"
  echo ""
  echo "  npx tsx skills/fe-visual-tdd/scripts/figma-export.ts \\"
  echo "    --file-key <FILE_KEY> --node-ids <NODE_ID> \\"
  echo "    --out visual-qa/expected --scale 1"
  echo ""
  echo "DO NOT generate the interaction spec without expected images."
  echo "============================================================"
  echo ""
  exit 1
fi

shopt -s nullglob
files=("$DIR"/*.{png,jpg,svg,pdf})
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo ""
  echo "============================================================"
  echo "[GATE FAILED] Directory '$DIR' exists but contains NO image files."
  echo ""
  echo "figma-export.ts either was not run or failed silently."
  echo "Go back to Step 0-1 and run:"
  echo ""
  echo "  npx tsx skills/fe-visual-tdd/scripts/figma-export.ts \\"
  echo "    --file-key <FILE_KEY> --node-ids <NODE_ID> \\"
  echo "    --out visual-qa/expected --scale 1"
  echo ""
  echo "DO NOT generate the interaction spec without expected images."
  echo "============================================================"
  echo ""
  exit 1
fi

echo ""
echo "[GATE PASSED] Found ${#files[@]} expected image(s) in $DIR:"
echo ""
for f in "${files[@]}"; do
  echo "  - $f"
done
echo ""
echo "You may now proceed to generate the interaction spec."
echo "Include these paths in the 'Expected images' section of the spec."
echo ""
