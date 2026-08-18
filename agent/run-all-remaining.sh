#!/usr/bin/env bash
# Run all remaining journeys sequentially (one sim → must be serial).
# Each journey's full output goes to its own log; a summary is printed at the end.
set -uo pipefail
cd "$(dirname "$0")"

SUMMARY="/private/tmp/claude-501/-Users-tmgnr-poteau-workspace/0a2ae7bc-f3e6-4112-9783-1c14faafd5a7/scratchpad/run-all-summary.txt"
: > "$SUMMARY"

JOURNEYS=(
  "join-pay-near-removal"
  "join-pay-last-minute"
  "create-public-game-soccer"
  "create-public-game-padel"
  "signup-new-user"
  "signup-abandon-onboarding"
  "signup-deny-photo"
)

for j in "${JOURNEYS[@]}"; do
  echo "======================================================================"
  echo ">>> RUNNING: $j   ($(date '+%H:%M:%S'))"
  echo "======================================================================"
  # Extra flags per journey
  extra=""
  case "$j" in
    signup-deny-photo) extra="--deny-photo" ;;
  esac

  # Let the driver own companion lifecycle (its startCompanion kills stale ones
  # first). Just make sure the app is terminated for a clean cold start.
  xcrun simctl terminate EB99DAC3-2756-4233-A12D-E4C99D496912 com.krank.club 2>/dev/null || true
  sleep 3

  out=$(./run.sh "$j" $extra 2>&1)
  # capture the OUTCOME line
  verdict=$(printf '%s\n' "$out" | grep -E "^OUTCOME:" | tail -1)
  [ -z "$verdict" ] && verdict="OUTCOME: (no verdict — see log)"
  steps=$(printf '%s\n' "$out" | grep -oE "Steps: [0-9]+" | tail -1)
  echo "$j → $verdict   [$steps]" | tee -a "$SUMMARY"
  echo ""
done

echo "======================================================================"
echo "ALL DONE. Summary:"
cat "$SUMMARY"
echo "======================================================================"
