#!/bin/zsh
# Recurring publishGame price monitor -> #health-reports.
#
# Replaces the four one-shot launchd jobs written on 2026-09-10
# (com.poteau.publishpricewatch{1h,3h,6h,nextam}). Those were pinned to
# `Day 10` and unloaded themselves after firing, so from 2026-09-11 onward
# nothing posted at all and the channel went quiet while the incident was
# still open. A watch that silently stops is worse than no watch: the absence
# of bad news reads as good news.
#
# Runs hourly with a 60-minute window, so each report covers exactly the hour
# since the last one. The window must match the interval: an overlapping window
# re-reports the same blocked organizer in consecutive posts, which makes one
# incident look like several and is how "Guard refusals: 25" read as volume
# rather than one person retrying.
#
# Usage: run_publish_price_monitor.sh [WINDOW_MINUTES]
set -u

WINDOW="${1:-60}"

# gcloud must be the adminsdk SA. Parallel sessions switch core/account to
# poteau-billing@, which cannot read logs -- the monitor then reports
# "could not read Cloud Logging" and (correctly) posts red. Pin it here so a
# scheduled run is never at the mercy of whatever a terminal left behind.
export PATH="/Users/tmgnr/.nvm/versions/node/v20.19.4/bin:/Users/tmgnr/google-cloud-sdk/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
gcloud config set core/account firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com >/dev/null 2>&1

# The webhook is bound to #health-reports and cannot be retargeted.
if [[ -f /Users/tmgnr/.poteau/slack_webhook.env ]]; then
  source /Users/tmgnr/.poteau/slack_webhook.env
fi

if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "$(date -u +%FT%TZ) SLACK_WEBHOOK_URL missing - running without posting"
fi

cd /Users/tmgnr/poteau-workspace/scripts || exit 1
echo "$(date -u +%FT%TZ) running monitor (window ${WINDOW}m)"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}" node monitor_publish_price.js "$WINDOW"
