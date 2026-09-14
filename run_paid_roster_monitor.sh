#!/bin/zsh
# Recurring paid-roster monitor -> #health-reports.
#
# Watches the 2026-09-14 fix that makes syncPaymentAndSpots write `attendees`
# alongside `teams`. Three things can go wrong and all three are money:
#
#   - a payer left off the roster still holds a live Stripe authorization
#     nobody can release (the original bug),
#   - a payer added TWICE gains a phantom +1, inflating attendees.length --
#     which is what handlePaymentAuth reads to choose CAPTURE vs CANCEL, so it
#     can charge a whole game that never filled (the fix going wrong),
#   - the new updateTeamsAttendees guard blocks a reset, meaning the first net
#     missed something.
#
# Hourly with a 60-minute window, matching the interval: an overlapping window
# re-reports the same person hour after hour and makes one incident look like
# several. Same reasoning as run_publish_price_monitor.sh.
#
# Usage: run_paid_roster_monitor.sh [WINDOW_MINUTES]
set -u

WINDOW="${1:-60}"

# gcloud must be the adminsdk SA. Parallel sessions switch core/account to
# poteau-billing@, which cannot read logs -- the monitor then reports
# "state unknown" and (correctly) posts white. Pin it here so a scheduled run
# is never at the mercy of whatever a terminal left behind.
export PATH="/Users/tmgnr/.nvm/versions/node/v20.19.4/bin:/Users/tmgnr/google-cloud-sdk/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
gcloud config set core/account firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com >/dev/null 2>&1

# The webhook is bound to #health-reports and cannot be retargeted.
if [[ -f /Users/tmgnr/.poteau/slack_webhook.env ]]; then
  source /Users/tmgnr/.poteau/slack_webhook.env
fi

if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "$(date -u +%FT%TZ) SLACK_WEBHOOK_URL missing - running without posting"
fi

# Strandings created BEFORE the fix went live must not make every run red
# forever. Set once at deploy time; the monitor labels anything older as
# "(pre-fix)" rather than counting it against the fix.
export PAID_ROSTER_FIX_LIVE="${PAID_ROSTER_FIX_LIVE:-2026-09-14T12:00:00Z}"

cd /Users/tmgnr/poteau-workspace/scripts || exit 1
echo "$(date -u +%FT%TZ) running paid-roster monitor (window ${WINDOW}m)"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}" node monitor_paid_roster.js "$WINDOW"
