#!/bin/bash
# Autonomous operator guard. Runs hunt_operator.js every 15 minutes with --ban.
#
# Standing orders from Tim, 2026-09-19, while AFK: "I prefer you go too far
# than too safe." So this bans without asking, at a threshold verified against
# every high-volume organiser in production (the operator scored 13, the next
# legitimate organiser scored 2).
#
# Every ban is reversible, goes through the same applySpamBan path a moderator's
# Slack button uses, and is logged here with its full reasoning.
#
# Usage: guard_operator.sh [total_minutes] [interval_seconds]
set -uo pipefail
cd "$(dirname "$0")" || exit 1

TOTAL_MIN="${1:-300}"
INTERVAL="${2:-900}"
DEADLINE=$(( $(date +%s) + TOTAL_MIN * 60 ))
LOG="$(dirname "$0")/.guard_operator.log"
TICK=0

echo "[$(date '+%H:%M')] guard started — every $((INTERVAL/60))min for ${TOTAL_MIN}min" | tee -a "$LOG"

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    TICK=$((TICK + 1))
    NOW=$(date '+%H:%M')

    # 6h window each tick: wide enough that a slow account which only becomes
    # suspicious after a few games is still in scope, narrow enough to stay fast.
    OUT=$(timeout 800 node hunt_operator.js --since=6h --ban 2>&1)
    BANNED=$(printf '%s' "$OUT" | grep -c '^BANNED ' || true)
    LOOK=$(printf '%s' "$OUT" | grep -c '^look ' || true)

    echo "[$NOW] tick $TICK | banned=$BANNED | review=$LOOK" | tee -a "$LOG"

    if [ "$BANNED" -gt 0 ] || [ "$LOOK" -gt 0 ]; then
        printf '%s\n' "$OUT" | grep -E '^(BAN|look|BANNED|FAILED) ' | tee -a "$LOG"
    fi

    # A crash must be loud, not silent.
    if printf '%s' "$OUT" | grep -qE '^(Error|TypeError|ReferenceError)'; then
        echo "[$NOW] HUNTER CRASHED:" | tee -a "$LOG"
        printf '%s\n' "$OUT" | head -5 | tee -a "$LOG"
    fi

    sleep "$INTERVAL"
done

echo "[$(date '+%H:%M')] guard finished after ${TOTAL_MIN}min" | tee -a "$LOG"
