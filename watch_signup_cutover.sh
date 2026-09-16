#!/bin/bash
# Watch the handleSignup gen2 cutover.
#
# Two signals per tick, because they fail differently and on different clocks:
#
#   1. INVOCATIONS (Cloud Run logs) — immediate. handleSignup fires on every
#      write to any users document, roughly 100/hour, so silence for a whole
#      tick means the trigger has detached. This is the fast alarm.
#
#   2. COMPLETION (Firestore) — the real outcome. Any signup carrying a
#      connector but no signup_handled_at is a user who may have received no
#      verification code, and there is no resend path in the app.
#
# Only speaks when something is wrong. A green tick prints locally and posts
# nothing: at ~9 email signups a day most ticks see zero signups, and a channel
# that reports "fine" every ten minutes gets muted, which costs the one alert
# that matters.
#
# Usage: watch_signup_cutover.sh [total_minutes] [interval_seconds]
set -uo pipefail

cd "$(dirname "$0")" || exit 1

TOTAL_MIN="${1:-120}"
INTERVAL="${2:-600}"
DEADLINE=$(( $(date +%s) + TOTAL_MIN * 60 ))
TICK=0

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    TICK=$((TICK + 1))
    NOW=$(date -u +%H:%M)

    # 1. Did the function run at all in the last 15 minutes?
    # `grep -c . || echo 0` is wrong here: when grep matches nothing it prints 0
    # AND exits 1, so the fallback appends a second line and the test below sees
    # "0\n0". Count with wc and strip whitespace instead.
    INVOCATIONS=$(gcloud logging read \
        'resource.type="cloud_run_revision" AND resource.labels.service_name="handlesignup"' \
        --project=krank-club --limit=500 --format="value(timestamp)" --freshness=15m 2>/dev/null \
        | grep -c . | tr -d '[:space:]')
    INVOCATIONS=${INVOCATIONS:-0}

    # 2. Any error since the cutover?
    ERRORS=$(gcloud logging read \
        'resource.type="cloud_run_revision" AND resource.labels.service_name="handlesignup" AND severity>=ERROR' \
        --project=krank-club --limit=50 --format="value(textPayload)" --freshness=15m 2>/dev/null \
        | grep -c . | tr -d '[:space:]')
    ERRORS=${ERRORS:-0}

    # 3. Completion check, and the Slack post when it is not green.
    OUT=$(node monitor_handle_signup.js --dry 2>&1)
    STATE=$(printf '%s' "$OUT" | head -1 | grep -oE '✅|🟠|🚨|⏳' || echo "?")

    echo "[$NOW] tick $TICK | invocations(15m)=$INVOCATIONS errors=$ERRORS state=$STATE"

    ALERT=""
    if [ "$INVOCATIONS" -eq 0 ]; then
        ALERT="handleSignup logged NOTHING in 15 minutes. It fires on every users write (~100/h), so the trigger has probably detached. gen1 is deleted: nobody can finish an email signup."
    elif [ "$ERRORS" -gt 0 ]; then
        ALERT="handleSignup logged $ERRORS error(s) in the last 15 minutes."
    elif [ "$STATE" = "🚨" ] || [ "$STATE" = "🟠" ]; then
        ALERT="signup completion check is not green."
    fi

    if [ -n "$ALERT" ]; then
        echo "  ALERT: $ALERT"
        node monitor_handle_signup.js 2>&1 | tail -2
    fi

    sleep "$INTERVAL"
done

echo "Watch finished after ${TOTAL_MIN} minutes. Posting a final summary."
node monitor_handle_signup.js 2>&1 | tail -3
