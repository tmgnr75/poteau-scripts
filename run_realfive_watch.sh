#!/bin/zsh
# Hourly watch: has RealFive Pont-à-Mousson published its first games yet?
# Scheduled by ~/Library/LaunchAgents/com.poteau.realfivewatch.plist
#
# The node script owns all the logic and its own state, including retiring
# itself once the centre launches (or after 30 quiet days). This wrapper only
# supplies the Slack webhook and the centre uid, then gets out of the way.
set -uo pipefail

SD=/Users/tmgnr/poteau-workspace/scripts
cd "$SD" || exit 1

# The centre uid, minted by createRealFivePontAMousson.js --write.
export REALFIVE_UID="W514nnZZkwR1XVX666uDzTnvunY2"

# A webhook is bound to one channel forever; keep it in the env file.
if [ -f "$HOME/.poteau/slack_webhook.env" ]; then
  . "$HOME/.poteau/slack_webhook.env"
  export SLACK_WEBHOOK_URL
  export SLACK=1
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
node watch_realfive_first_games.js

# Once the script has retired itself there is nothing left to schedule.
if node watch_realfive_first_games.js --status 2>/dev/null | grep -q '"retired": true'; then
  echo "Watch retired, unloading the launch agent."
  launchctl unload "$HOME/Library/LaunchAgents/com.poteau.realfivewatch.plist" 2>/dev/null || true
fi
