#!/bin/zsh
# One tick of the push health check, on a fixed launchd interval.
#
# Replaces run_gen2_peak_watch.sh, which was log-based and paged Tim at 11:00 on
# 2026-08-27 claiming "85,759 pushes never sent". Nothing was wrong: the real
# figures for that window were 121,136 documents and 120,836 requests with ZERO
# errors. The alert had compared a true Firestore count against a TRUNCATED log
# fetch -- its own output gave it away, reporting exactly "2000 push + 2000
# email", which are query row caps rather than measurements.
#
# This one reads Cloud Monitoring, which aggregates server-side: no row caps, no
# truncation, and a failed call surfaces as UNKNOWN rather than a plausible zero.
set -uo pipefail
OUT=$("$HOME/poteau-workspace/scripts/push_health.sh" 20 2>&1)
echo "$OUT"

V=$(printf '%s' "$OUT" | grep 'VERDICT' | sed 's/.*: //')
# Only page on a real problem. A quiet channel is the point: the previous watch
# taught Tim to distrust its alarms, which is worse than no watch at all.
if [ "$V" != "HEALTHY" ] && [ -f "$HOME/.poteau/slack_webhook.env" ]; then
  . "$HOME/.poteau/slack_webhook.env"
  T="🔴 *Push health* · $(date +%H:%M) · $V\n\`\`\`$OUT\`\`\`"
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$(printf '%b' "$T" | sed 's/"/\\"/g')\"}" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
fi
