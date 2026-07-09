#!/usr/bin/env bash
# Poteau agent UI-testing — entrypoint.
#   ./run.sh <journey-name> [extra args passed to run.js]
#   ./run.sh join-a-padel-game
#   ./run.sh join-a-padel-game --no-build   # skip reinstalling the app
#
# Requires ANTHROPIC_API_KEY in the environment.
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${1:-}" ]; then
  echo "Usage: ./run.sh <journey-name> [--udid UDID] [--no-build] [--keep-app]"
  echo "Journeys:"
  ls journeys/*.md 2>/dev/null | sed 's#journeys/##;s#\.md##' | sed 's/^/  /'
  exit 2
fi

# Load .env (gitignored) so ANTHROPIC_API_KEY need not be exported globally.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set (put it in scripts/agent/.env or export it)." >&2
  exit 2
fi

exec node run.js "$@"
