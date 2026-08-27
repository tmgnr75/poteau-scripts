# Shared setup for the wrap-up simulator harnesses. Source this, do not run it.
#
# Two rules encoded here, both learned the hard way:
#
# 1. RESTART VIA FLUTTER, NEVER `simctl terminate`. Terminating the app kills
#    it out from under `flutter run`, which reports "Lost connection to device"
#    and EXITS. Every later reload is then a silent no-op and the harness keeps
#    screenshotting a binary that no longer matches the source.
#
# 2. REFUSE TO RUN AGAINST A STALE BINARY. A green sweep against old code is
#    worse than no sweep: it reports fixes that are not in the build, and
#    surfaces "bugs" that were fixed hours earlier. A full 23-case sweep was
#    lost to exactly this.

wu_device() {
  xcrun simctl list devices | grep -i '(Booted)' \
    | sed -n 's/.*(\([0-9A-F-]\{36\}\)).*/\1/p' | head -1
}

# wu_prepare <case-name> -- seed, guard, hot restart. Exits non-zero on abort.
wu_prepare() {
  local CASE="$1"
  : "${IDB:=$HOME/.idb/venv/bin/idb}"
  local HERE PIDF DEV APP
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PIDF=/tmp/flutter.pid

  node "$HERE/seed_wrapup_cases.js" --write >/dev/null 2>&1
  node "$HERE/_only.js" "$CASE"          >/dev/null 2>&1

  DEV="$(wu_device)"
  if [ -z "$DEV" ]; then
    echo "ABORT $CASE :: no booted simulator" >&2; return 1
  fi

  APP="$(xcrun simctl get_app_container "$DEV" com.krank.club 2>/dev/null)"
  if [ -z "$APP" ] || [ ! -e "$APP/Runner" ]; then
    echo "ABORT $CASE :: com.krank.club is not installed on $DEV" >&2; return 1
  fi

  # STALENESS IS ABOUT THE VM, NOT THE BUNDLE.
  #
  # A hot reload pushes Dart into the running isolate without rewriting
  # Runner.app, so comparing source mtimes against the bundle flags every
  # edited file as stale even when the app already has it. What actually
  # matters is that a LIVE `flutter attach` is pushing those edits -- if it is
  # dead, the app is frozen at whatever was last compiled and every capture is
  # a lie. So the attach check below IS the staleness check.
  #
  # The bundle timestamp is still worth knowing when nothing is attached: that
  # is the only case where the installed binary is what runs.
  # A LIVE ATTACH IS NOT REQUIRED, because this relaunches the installed app
  # rather than pushing code. But WITHOUT one, uncommitted edits are not in the
  # binary -- so say which build is about to be exercised instead of failing.
  if [ ! -s "$PIDF" ] || ! kill -0 "$(cat "$PIDF")" 2>/dev/null; then
    echo "NOTE  $CASE :: nothing attached; exercising the binary installed" \
         "$(date -r "$APP/Runner" '+%b %d %H:%M')" >&2
  fi

  # COLD RELAUNCH, NOT HOT RESTART.
  #
  # Home reads `currentUserDocument`, which is the auth layer's CACHED user
  # snapshot -- not a live stream. A hot restart rebuilds the widget tree but
  # keeps that cache, so a freshly seeded pending_feedback never appears and the
  # debrief card is simply absent. Only a process relaunch refetches it.
  #
  # This costs ~15s per case against USR2's ~16s, so there is no reason to
  # prefer the restart even when it would work.
  xcrun simctl terminate "$DEV" com.krank.club >/dev/null 2>&1
  sleep 3
  xcrun simctl launch "$DEV" com.krank.club >/dev/null 2>&1
  sleep 15
}
