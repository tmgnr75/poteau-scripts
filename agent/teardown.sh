#!/usr/bin/env bash
# Poteau agent UI-testing — one-command teardown.
# Reverses ALL test fixtures: 10 test accounts, seeded games, QA-account flag.
# Also removes the local sim app + gitignored API key.
#
#   ./teardown.sh          # dry-run (shows what would be deleted)
#   ./teardown.sh --live   # actually delete
set -euo pipefail
cd "$(dirname "$0")"

LIVE=""
[ "${1:-}" = "--live" ] && LIVE="--live"

echo "### Firestore / Auth teardown ###"
node ../teardown_test_accounts.js $LIVE

if [ "$LIVE" = "--live" ]; then
  echo ""
  echo "### Local cleanup ###"
  # Uninstall the app from the sim (best-effort).
  UDID="${AGENT_SIM_UDID:-EB99DAC3-2756-4233-A12D-E4C99D496912}"
  xcrun simctl uninstall "$UDID" com.krank.club 2>/dev/null && echo "Uninstalled app from sim $UDID" || echo "(app not installed / sim not booted)"
  echo "Run folders kept at scripts/agent/runs/ (delete manually if desired)."
  echo "NOTE: scripts/agent/.env (API key) left in place — delete it or rotate the key."
else
  echo ""
  echo "(dry-run — re-run with --live to also uninstall the sim app.)"
fi
