#!/usr/bin/env bash
# Hot reload (or restart) the running app, safely.
#
# WHY THIS EXISTS. Iterating on Poteau was costing ~5 minutes a change because
# the run kept being killed and rebuilt. Almost nothing needs that:
#
#   copy, colours, layout, logic   hot reload   ~350ms
#   anything read in initState     hot restart  ~1.5s
#   pubspec, native, assets        full build   ~5min
#
# TWO TRAPS THIS AVOIDS, both of which cost a session on 2026-09-02:
#
#   1. THE PIDFILE CAN BE STALE OR WRONG. `--pid-file` and the live process
#      have differed by a few PIDs, and signalling the wrong one KILLS the run
#      (there is no handler, so SIGUSR1 terminates). This prefers the pidfile
#      but refuses to signal anything that is not actually a `flutter run`.
#
#   2. A DETACHED RUN RELOADS NOTHING. If `simctl launch` started the app
#      separately, the run is no longer attached: the signal succeeds, the
#      screen never changes, and the binary stays stale. Verify with --verify.
#
#   ./reload.sh              hot reload
#   ./reload.sh restart      hot restart (initState runs again)
#   ./reload.sh --verify STR grep the INSTALLED binary for STR
set -u

SIM="EB99DAC3-2756-4233-A12D-E4C99D496912"

if [ "${1:-}" = "--verify" ]; then
  needle="${2:?usage: reload.sh --verify <string>}"
  app=$(find ~/Library/Developer/CoreSimulator/Devices/"$SIM"/data/Containers/Bundle/Application \
        -name "Runner.app" -maxdepth 3 2>/dev/null | head -1)
  blob="$app/Frameworks/App.framework/flutter_assets/kernel_blob.bin"
  n=$(grep -a -c "$needle" "$blob" 2>/dev/null || echo 0)
  # A failed grep returns empty, which reads deceptively like "no matches".
  if [ "$n" -gt 0 ]; then
    echo "IN THE BINARY ($n) — $needle"
  else
    echo "NOT in the binary — $needle  (the app on screen predates this change)"
  fi
  exit 0
fi

live=$(pgrep -f "flutter run" | head -1)
if [ -z "$live" ]; then
  echo "No 'flutter run' is alive. Start one before reloading."
  exit 1
fi

pid=""
if [ -f /tmp/flutter.pid ]; then
  candidate=$(cat /tmp/flutter.pid)
  # Only trust the pidfile if it really names a flutter run.
  if ps -p "$candidate" -o command= 2>/dev/null | grep -q "flutter"; then
    pid="$candidate"
  fi
fi
[ -z "$pid" ] && pid="$live"

if [ "${1:-}" = "restart" ]; then
  kill -USR2 "$pid" && echo "hot restart -> $pid"
else
  kill -USR1 "$pid" && echo "hot reload -> $pid"
fi

sleep 2
pgrep -f "flutter run" >/dev/null \
  && echo "run still alive" \
  || echo "RUN DIED — the pid had no handler. Relaunch with --pid-file."
