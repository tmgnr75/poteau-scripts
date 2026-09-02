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
  # THE LIVE VM, NOT THE DISK BUNDLE.
  #
  # kernel_blob.bin is the last FULL BUILD and never changes on hot reload, so
  # grepping it reports "not in the binary" for code that is running fine. That
  # false negative cost a round of pointless rebuilds on 2026-09-02.
  #
  # The VM's own copy of the source is what is actually executing.
  ws=$(grep -ho "ws://127\.0\.0\.1:[0-9]*/[^/]*/ws" \
        "${FLUTTER_LOG:-}" 2>/dev/null | tail -1)
  if [ -z "$ws" ]; then
    url=$(grep -ho "http://127\.0\.0\.1:[0-9]*/[A-Za-z0-9_=-]*/" \
          /private/tmp/claude-501/*/*/scratchpad/run*.log 2>/dev/null | tail -1)
    [ -n "$url" ] && ws="ws://${url#http://}ws"
  fi
  if [ -z "$ws" ]; then
    echo "No VM service URL found. Pass the run log as FLUTTER_LOG=..."
    exit 1
  fi
  python3 "$(dirname "$0")/vm_source.py" "$ws" "$needle"
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
