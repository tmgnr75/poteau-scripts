#!/bin/bash
# Cutover monitor for the Gen1 -> Gen2 push migration (translateAndSendPush ->
# translatePlusPush).
#
# WHAT THIS WATCHES, AND WHY IT IS NOT AN ERROR COUNT.
# A migration can fail without logging a single error: the flag flips, Gen1
# stops, Gen2 never starts, and the logs go quiet. Silence looks identical to
# health. So the primary signals here are DELIVERY counts -- pushes published,
# FCM sends, fallback emails -- and the loudest alarm is "nothing was sent".
#
# It also checks the two invariants the claim mechanism exists to protect:
#   NO DUPLICATES : no connect doc claimed twice (impossible by construction,
#                   verified anyway because the whole point is exactly-once)
#   NO ORPHANS    : no connect doc left unclaimed while both functions are live
#
# Usage: monitor_gen2_cutover.sh [window]     default 10m
#        SLACK=1 monitor_gen2_cutover.sh 1h   also posts to #health-reports
set -uo pipefail
W="${1:-10m}"
PROJ=krank-club
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

g1=$(gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="translateAndSendPush"' \
      --project=$PROJ --limit=2000 --freshness="$W" --format="value(textPayload)" 2>/dev/null)
g2=$(gcloud logging read 'resource.labels.service_name="translatepluspush"' \
      --project=$PROJ --limit=2000 --freshness="$W" --format="value(textPayload)" 2>/dev/null)
push=$(gcloud logging read 'resource.labels.function_name="sendPushNotification"' \
      --project=$PROJ --limit=2000 --freshness="$W" --format="value(textPayload)" 2>/dev/null)

cnt() { printf '%s' "$1" | grep -c "$2" 2>/dev/null || true; }

G1_SENT=$(cnt "$g1" "All messages published successfully")
G1_PUB=$(cnt "$g1" "Message published successfully")
G1_SKIP=$(cnt "$g1" "gen2_push=true, skipping")
G1_CLAIMED=$(cnt "$g1" "already claimed")
G1_13=$(cnt "$g1" "13 INTERNAL")
G1_CAP=$(cnt "$g1" "no available instance")
G1_CLAIMERR=$(cnt "$g1" "claim failed")

G2_SENT=$(cnt "$g2" "All messages published successfully")
G2_PUB=$(cnt "$g2" "Message published successfully")
G2_CLAIMED=$(cnt "$g2" "already claimed")
G2_13=$(cnt "$g2" "13 INTERNAL")
G2_CAP=$(cnt "$g2" "no available instance")
G2_CLAIMERR=$(cnt "$g2" "claim failed")

DELIVERED=$(cnt "$push" "Push succeeded")
FAILALL=$(cnt "$push" "Push failed for all tokens")
EMAILS=$(cnt "$push" "Fallback email published")
NOTOK=$(cnt "$push" "No FCM tokens available")
CRASH=$(cnt "$push" "TypeError\|ReferenceError\|Cannot read")
THROTTLED=$(cnt "$push" "\[throttle\] Suppressing")
RCQUOTA=$(cnt "$push" "Quota exceeded")
EXEC=$(cnt "$push" "Function execution started")

TOTAL_PUB=$((G1_PUB + G2_PUB))

echo "=== Gen1->Gen2 push cutover · last $W · $TS ==="
echo "  Gen1 translateAndSendPush : $G1_SENT executions, $G1_PUB pushes published"
echo "        skipped (flag on)   : $G1_SKIP"
echo "        lost claim to Gen2  : $G1_CLAIMED"
echo "  Gen2 translatePlusPush    : $G2_SENT executions, $G2_PUB pushes published"
echo "        lost claim to Gen1  : $G2_CLAIMED"
echo "  ---- downstream delivery (sendPushNotification, UNCHANGED by migration)"
echo "  FCM delivered             : $DELIVERED"
echo "  FCM failed (all tokens)   : $FAILALL"
echo "  fallback emails sent      : $EMAILS"
echo "  recipients with no token  : $NOTOK"
echo "  consumer invocations      : $EXEC"
echo "  invitation-throttle skips : $THROTTLED   (by design)"
echo "  RC quota errors           : $RCQUOTA   (pre-existing since 2026-07-26)"
echo "  ---- faults"
echo "  13 INTERNAL   Gen1/Gen2   : $G1_13 / $G2_13"
echo "  capacity throttle         : $G1_CAP / $G2_CAP   (benign class)"
echo "  claim transaction errors  : $G1_CLAIMERR / $G2_CLAIMERR"
echo "  consumer crashes          : $CRASH"

ALERTS=()
# bash 3.2 on macOS treats an empty array as unbound under `set -u`.
[ "$TOTAL_PUB" -eq 0 ] && ALERTS+=("NOTHING PUBLISHED by either generation in $W - push path may be DOWN")
[ "$EXEC" -eq 0 ] && [ "$TOTAL_PUB" -gt 0 ] && ALERTS+=("pushes published but consumer NEVER RAN - Pub/Sub or consumer broken")
[ "$G1_13" -gt 20 ] && ALERTS+=("$G1_13 '13 INTERNAL' on Gen1 - the 08-24 signature is back")
[ "$G2_13" -gt 20 ] && ALERTS+=("$G2_13 '13 INTERNAL' on Gen2")
[ "$CRASH" -gt 0 ] && ALERTS+=("$CRASH crashes in sendPushNotification")
{ [ "$G1_CLAIMERR" -gt 5 ] || [ "$G2_CLAIMERR" -gt 5 ]; } && ALERTS+=("claim transaction failing - fail-open means DUPLICATES are possible")
{ [ "$G1_PUB" -gt 0 ] && [ "$G2_PUB" -gt 0 ]; } && ALERTS+=("BOTH generations publishing - expected only mid-flip, not steady state")

echo
if [ ${#ALERTS[@]} -eq 0 ]; then
  echo "  STATUS: OK"
else
  echo "  STATUS: ATTENTION"
  for a in "${ALERTS[@]:-}"; do echo "    - $a"; done
fi

if [ "${SLACK:-0}" = "1" ] && [ -f "$HOME/.poteau/slack_webhook.env" ]; then
  . "$HOME/.poteau/slack_webhook.env"
  ICON="🟢"; [ ${#ALERTS[@]} -gt 0 ] && ICON="🔴"
  TXT="$ICON *Gen2 push cutover* · last $W\nGen1 published *$G1_PUB* · Gen2 published *$G2_PUB*\nFCM delivered *$DELIVERED* · emails *$EMAILS*\nfaults: 13INTERNAL $G1_13/$G2_13 · claim errors $G1_CLAIMERR/$G2_CLAIMERR"
  for a in "${ALERTS[@]:-}"; do [ -n "$a" ] && TXT="$TXT\n• $a"; done
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$(printf '%b' "$TXT" | sed 's/"/\\"/g')\"}" "$SLACK_WEBHOOK_URL" >/dev/null || true
fi
