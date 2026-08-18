#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
UDID="EB99DAC3-2756-4233-A12D-E4C99D496912"
# Ensure the sim is up before the batch (a slept sim → 0-step runs).
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true
SUMMARY="/private/tmp/claude-501/-Users-tmgnr-poteau-workspace/0a2ae7bc-f3e6-4112-9783-1c14faafd5a7/scratchpad/retry-summary.txt"
: > "$SUMMARY"
JOURNEYS=( "create-public-game-soccer" "create-public-game-padel" "signup-new-user" "signup-abandon-onboarding" "signup-deny-photo" )
for j in "${JOURNEYS[@]}"; do
  echo "====================== RUNNING: $j ($(date '+%H:%M:%S')) ======================"
  extra=""; case "$j" in signup-deny-photo) extra="--deny-photo" ;; esac
  xcrun simctl terminate EB99DAC3-2756-4233-A12D-E4C99D496912 com.krank.club 2>/dev/null || true
  sleep 3
  out=$(./run.sh "$j" $extra 2>&1)
  verdict=$(printf '%s\n' "$out" | grep -E "^OUTCOME:" | tail -1); [ -z "$verdict" ] && verdict="OUTCOME: (no verdict)"
  steps=$(printf '%s\n' "$out" | grep -oE "Steps: [0-9]+" | tail -1)
  echo "$j → $verdict   [$steps]" | tee -a "$SUMMARY"
done
echo "====================== ALL DONE ======================"; cat "$SUMMARY"
