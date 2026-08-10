#!/bin/bash
# Health check for sendPushNotification after the deleteFCMToken by-ref change
# (2026-08-11). The function is the highest-volume notification path in Poteau
# and a silent delivery failure means players do not show up to games, so the
# numbers that matter are the DELIVERY ones, not just the absence of errors.
#
# Usage: monitor_push_health.sh [freshness]   e.g. ./monitor_push_health.sh 2h
FRESH="${1:-30m}"
echo "=== sendPushNotification health · last $FRESH · $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
gcloud logging read 'resource.labels.function_name="sendPushNotification"' \
  --project=krank-club --limit=2000 --freshness="$FRESH" \
  --format="value(textPayload)" 2>/dev/null | awk '
/Push succeeded/                 {s++}
/Push failed for token/          {ft++}
/Push failed for all tokens/     {fa++}
/\(by ref\)/                     {byref++}
/FAILED_PRECONDITION/            {fp++}
/Error deleting token/           {edt++}
/Email sent|Fallback email published/ {em++}
/No FCM tokens available/        {notok++}
/\[transactional\]/              {tx++}
/TypeError|ReferenceError|is not a function|Cannot read/ {crash++}
END {
  printf "  delivered            : %d\n", s+0
  printf "  failed (per token)   : %d\n", ft+0
  printf "  failed (all tokens)  : %d\n", fa+0
  printf "  cleaned up by ref    : %d   (new path)\n", byref+0
  printf "  FAILED_PRECONDITION  : %d   (was ~every dead token)\n", fp+0
  printf "  Error deleting token : %d\n", edt+0
  printf "  fallback emails      : %d\n", em+0
  printf "  users with 0 tokens  : %d\n", notok+0
  printf "  transactional sends  : %d\n", tx+0
  printf "  JS errors            : %d   <-- MUST be 0\n", crash+0
  if (crash+0 > 0) print "\n  !! JS errors present - investigate before anything else"
  if (s+0 == 0) print "\n  !! zero deliveries in window - either no traffic or a regression"
}'
echo
echo "--- any new error text (excluding known-benign) ---"
gcloud logging read 'resource.labels.function_name="sendPushNotification" AND severity>=ERROR' \
  --project=krank-club --limit=40 --freshness="$FRESH" --format="value(textPayload)" 2>/dev/null \
  | grep -viE "Push failed for token|registration-token-not-registered|invalid-registration-token|Push failed for all tokens|Sending email instead|Didn't send email" \
  | sort | uniq -c | sort -rn | head -10
echo "(empty above = only known-benign errors)"
