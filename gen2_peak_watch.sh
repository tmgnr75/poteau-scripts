#!/bin/bash
# Gen2 push-migration watch. ONE report, run on a schedule by launchd.
#
# Reports what a person actually needs to decide: is every push being sent, is
# it being delivered, and is the new capacity holding. Log counts alone cannot
# answer the first one -- a doc whose trigger never fired leaves NO log line, so
# the authoritative signal is the `pushed` marker in Firestore, read by
# check_unclaimed.js.
#
# Usage: gen2_peak_watch.sh [window]      default 10m
#        SLACK=1 gen2_peak_watch.sh 1h    also posts to #health-reports
set -uo pipefail
W="${1:-10m}"
# Accept a bare number as minutes. gcloud silently returns NOTHING for a
# unitless --freshness, which made every counter read zero and the watch shout
# "NOTHING published" while 2,354 pushes were confirmed delivered in the same
# run. A monitor that fails to a false alarm is as bad as one that fails silent.
case "$W" in *[0-9]) W="${W}m";; esac
P=krank-club
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOCAL=$(date +%H:%M)
SD=/Users/tmgnr/poteau-workspace/scripts

case "$W" in *m) WMIN=${W%m};; *h) WMIN=$(( ${W%h} * 60 ));; *) WMIN=10;; esac

G2=$(gcloud logging read 'resource.labels.service_name="translatepluspush"' --project=$P --limit=1500 --freshness="$W" --format="value(textPayload)" 2>/dev/null || true)
G1=$(gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="translateAndSendPush"' --project=$P --limit=1500 --freshness="$W" --format="value(textPayload)" 2>/dev/null || true)
PU=$(gcloud logging read 'resource.labels.function_name="sendPushNotification"' --project=$P --limit=1500 --freshness="$W" --format="value(textPayload)" 2>/dev/null || true)
WARN=$(gcloud logging read 'resource.labels.service_name="translatepluspush" AND severity>=WARNING' --project=$P --limit=300 --freshness="$W" --format="value(textPayload)" 2>/dev/null || true)

c(){ printf '%s' "$1" | grep -c "$2" 2>/dev/null || true; }
ci(){ printf '%s' "$1" | grep -ciE "$2" 2>/dev/null || true; }

# TARGETED queries, not greps over a bulk fetch. A generic fetch of this
# service truncates hard under load -- measured 183 publish lines where a
# targeted query found 2,361 -- which made the watch report "NOTHING published"
# while 2,353 pushes were confirmed delivered in the same run.
G2P=$(gcloud logging read 'resource.labels.service_name="translatepluspush" AND textPayload:"All messages published successfully"' \
      --project=$P --limit=20000 --freshness="$W" --format="value(labels.execution_id)" 2>/dev/null | grep -c . || true)
G1P=$(gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="translateAndSendPush" AND textPayload:"Message published successfully"' \
      --project=$P --limit=20000 --freshness="$W" --format="value(labels.execution_id)" 2>/dev/null | grep -c . || true)
G2T=$(c "$G2" "no available instance")
G1T=$(c "$G1" "no available instance")
OOM=$(ci "$WARN" "memory limit|exceeded memory|was killed|container terminated")
RCF=$(c "$G2$G1" "Failed to read")
I13=$(c "$G2$G1" "13 INTERNAL")
CLAIMED=$(c "$G1" "already claimed")
OKC=$(gcloud logging read 'resource.labels.function_name="sendPushNotification" AND textPayload:"Push succeeded"' \
      --project=$P --limit=20000 --freshness="$W" --format="value(labels.execution_id)" 2>/dev/null | grep -c . || true)
EM=$(gcloud logging read 'resource.labels.function_name="sendPushNotification" AND textPayload:"Fallback email published"' \
     --project=$P --limit=20000 --freshness="$W" --format="value(labels.execution_id)" 2>/dev/null | grep -c . || true)
FAIL=$(c "$PU" "Push failed for all tokens")
CR=$(printf '%s' "$PU" | grep -cE "TypeError|ReferenceError|Cannot read" 2>/dev/null || true)
EXEC=$(c "$PU" "Function execution started")

# check_delivery.js, NOT check_unclaimed.js. The latter read a `pushed` marker
# that no longer exists (the claim was removed 2026-08-26), so it now reports
# every document as delivered no matter what actually happened -- a detector
# that always says "fine" is worse than none.
UNC=$(node "$SD/check_delivery.js" "$WMIN" 2>&1 || true)
DROPN=$(printf '%s' "$UNC" | grep "NEVER SENT" | grep -oE ': [0-9]+' | grep -oE '[0-9]+' | head -1)
DROPN=${DROPN:-0}
DROPPCT=""
SENTN=$(printf '%s' "$UNC" | grep "confirmed published" | grep -oE ': [0-9]+' | grep -oE '[0-9]+' | head -1)
CLAIMS="gen2 only"
# UNKNOWN covers both a crash and a truncated log fetch. Either way the state
# is not proven healthy and must not be reported as such.
BROKEN=$(printf '%s' "$UNC" | grep -cE "check failed|RESULT: UNKNOWN" || true)

VERDICT="HEALTHY"; ACTION="none"
A=()
[ "$BROKEN" -gt 0 ] && { A+=("drop-detector itself failed - state UNKNOWN, not proven healthy"); VERDICT="UNKNOWN"; ACTION="re-run check_delivery.js with a shorter window"; }
[ "$OOM" -gt 0 ] && { A+=("$OOM OOM kill(s) - concurrency 80 is too high for 1GiB"); VERDICT="ACT NOW"; ACTION="lower concurrency to 50 and redeploy translatePlusPush"; }
[ "$DROPN" -gt 10 ] && { A+=("$DROPN pushes never sent"); VERDICT="ACT NOW"; ACTION="delete/disable translatePlusPush so Gen1 carries it alone"; }
[ "$G2T" -gt 50 ] && { A+=("$G2T Gen2 capacity throttles"); [ "$VERDICT" = HEALTHY ] && { VERDICT="WATCH"; ACTION="raise maxInstances above 1000"; }; }
[ "$RCF" -gt 0 ] && A+=("$RCF Remote Config read failures (should be 0 - nothing reads it now)")
[ "$CR" -gt 0 ] && { A+=("$CR crashes in the push consumer"); VERDICT="ACT NOW"; ACTION="inspect sendPushNotification logs"; }
[ $((G2P+G1P)) -eq 0 ] && [ "$WMIN" -ge 10 ] && { A+=("NOTHING published by either generation"); VERDICT="ACT NOW"; ACTION="check the push path is alive at all"; }
[ "$I13" -gt 20 ] && A+=("$I13 '13 INTERNAL' - the 2026-08-24 outage signature")

TOT=$((G2P+G1P)); SHARE=0
[ "$TOT" -gt 0 ] && SHARE=$(( 100*G2P/TOT ))

echo "=== Gen2 push migration - $LOCAL local ($TS) - window $W ==="
echo
echo "  VERDICT: $VERDICT"
[ "$ACTION" != "none" ] && echo "  ACTION : $ACTION"
echo
echo "  DID EVERY PUSH GET SENT?"
echo "    pushes never sent   : $DROPN   <- the number that matters"
echo "    confirmed published : ${SENTN:-?}"
echo "    claimed by          : ${CLAIMS:-n/a}"
echo "  WAS IT DELIVERED?"
echo "    FCM delivered       : $OKC"
echo "    fallback emails     : $EM"
echo "    failed all tokens   : $FAIL"
echo "    consumer runs       : $EXEC   crashes: $CR"
echo "  IS GEN2 CARRYING IT?"
echo "    published gen2/gen1 : $G2P / $G1P   (Gen2 share ${SHARE}%)"
echo "    Gen1 stood down     : $CLAIMED times"
echo "  IS THE CAPACITY HOLDING? (80 concurrency, 1GiB, no minInstances)"
echo "    OOM kills           : $OOM"
echo "    throttled gen2/gen1 : $G2T / $G1T"
echo "    RC failures         : $RCF"
echo "    13 INTERNAL         : $I13"
if [ ${#A[@]} -gt 0 ]; then echo; echo "  FLAGS:"; for x in "${A[@]:-}"; do [ -n "$x" ] && echo "    - $x"; done; fi

if [ "${SLACK:-0}" = "1" ] && [ -f "$HOME/.poteau/slack_webhook.env" ]; then
  . "$HOME/.poteau/slack_webhook.env"
  case "$VERDICT" in HEALTHY) I="🟢";; WATCH) I="🟡";; UNKNOWN) I="⚪";; *) I="🔴";; esac
  T="$I *Gen2 push migration* · $LOCAL · last $W\n*$VERDICT*"
  [ "$ACTION" != "none" ] && T="$T — _${ACTION}_"
  T="$T\nnever sent *$DROPN* ${DROPPCT:-} · delivered *$OKC* push + *$EM* email"
  T="$T\nGen2 share *${SHARE}%* (gen2 $G2P / gen1 $G1P) · OOM *$OOM* · throttled *$G2T*"
  for x in "${A[@]:-}"; do [ -n "$x" ] && T="$T\n• $x"; done
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$(printf '%b' "$T" | sed 's/"/\\"/g')\"}" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
fi
