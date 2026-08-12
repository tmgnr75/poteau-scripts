#!/bin/bash
# Where is the Flutter build up to?
#
# Run it whenever you want to know, or `watch -n5 ./build_status.sh` to follow
# it live. Reads only -- it never touches the build.
#
#   ./build_status.sh          one look
#   ./build_status.sh -w       refresh every 5s until the app is up
LOG=/tmp/flutter_run.log

status_once() {
  local now procs compiling
  now=$(date "+%H:%M:%S")
  procs=$(pgrep -f "flutter_tools.snapshot run" | wc -l | tr -d ' ')
  compiling=$(pgrep -f "xcodebuild|swift-frontend|clang" 2>/dev/null | wc -l | tr -d ' ')

  echo "[$now]"

  if [ "$procs" -eq 0 ]; then
    echo "  ✗ no flutter run process"
    [ -f "$LOG" ] && tail -2 "$LOG" | sed 's/^/    /'
    return
  fi
  if [ "$procs" -gt 1 ]; then
    # The failure mode that corrupts the render tree and wrecks an afternoon.
    echo "  ⚠️  $procs flutter run processes — they WILL fight over the build lock"
  fi

  if grep -q "Flutter run key commands" "$LOG" 2>/dev/null; then
    local secs errs
    secs=$(grep -oE "Xcode build done\. +[0-9.]+s" "$LOG" | tail -1 | grep -oE "[0-9.]+s")
    errs=$(grep -c "EXCEPTION CAUGHT" "$LOG" 2>/dev/null)
    echo "  ✅ APP IS UP (built in ${secs:-?})"
    if [ "${errs:-0}" -gt 0 ]; then
      echo "  ⚠️  $errs render exception(s) — layout is broken, taps may do nothing"
    else
      echo "  ✅ no render exceptions"
    fi
    return 0
  fi

  # Still building: how long, and is the compiler actually busy?
  local started elapsed
  started=$(stat -f %B "$LOG" 2>/dev/null)
  if [ -n "$started" ]; then
    elapsed=$(( $(date +%s) - started ))
    echo "  ⏳ building — ${elapsed}s elapsed (a cold build is ~320s)"
  else
    echo "  ⏳ building"
  fi
  echo "     $compiling compiler process(es) active"
  [ "$compiling" -eq 0 ] && echo "     ⚠️  nothing compiling — may be stalled at launch"
  tail -1 "$LOG" 2>/dev/null | sed 's/^/     /'
  return 1
}

if [ "$1" = "-w" ]; then
  while true; do
    clear; status_once && break
    sleep 5
  done
else
  status_once
fi
