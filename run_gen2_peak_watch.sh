#!/bin/zsh
# One tick of the Gen2 push-migration watch. Called by launchd on a FIXED
# interval; it does not schedule itself.
#
# The previous version re-armed by rewriting its own plist and calling
# `launchctl unload/load` on itself. That works when run by hand and FAILS under
# launchd: unloading a job that launchd is currently running SIGTERMs the script,
# so the reload line never executes. The result was a watch that ran exactly once
# and then sat dead with a stale plist -- loaded=0, no error, nothing in the log.
#
# StartInterval avoids the whole problem: launchd owns the cadence, the script
# only decides what WINDOW to report on based on time since the watch started.
set -uo pipefail
STAMP="$HOME/.poteau/gen2_peak_start"
W="$HOME/poteau-workspace/scripts/gen2_peak_watch.sh"
[ -f "$STAMP" ] || exit 0

ELAPSED=$(( ( $(date -u +%s) - $(cat "$STAMP") ) / 60 ))

# Phase 1  0-240min   : report every tick, 10m window   (evening peak)
# Phase 2  240-960min : report every 6th tick, 1h window (overnight)
# Phase 3  >960min    : final 12h summary, then disable itself
if [ "$ELAPSED" -lt 240 ]; then
  SLACK=1 "$W" 10m
elif [ "$ELAPSED" -lt 960 ]; then
  # launchd ticks every 10min; only report on the hour to keep it hourly.
  [ $(( (ELAPSED - 240) % 60 )) -lt 10 ] && SLACK=1 "$W" 1h
else
  echo "=== FINAL SUMMARY after ${ELAPSED}min ==="
  SLACK=1 "$W" 12h
  rm -f "$STAMP"
  # Disabling from inside a launchd-run script is what broke the last version,
  # so leave the job loaded and let the stamp check above make it a no-op.
fi
