#!/bin/zsh
# Self-rescheduling watch for the Gen2 push migration.
#
# Cadence (Tim, 2026-08-25): every 10 min through the evening peak, then hourly
# overnight, then a summary tomorrow morning. One job that re-arms itself rather
# than ~40 one-shot plists, so a reboot mid-watch resumes on the right cadence
# instead of restarting the sequence.
#
# Start:  ~/.poteau/oneshots/run_gen2_peak_watch.sh --start
# Stop :  ~/.poteau/oneshots/run_gen2_peak_watch.sh --stop
set -uo pipefail
STAMP="$HOME/.poteau/gen2_peak_start"
PLIST="$HOME/Library/LaunchAgents/com.poteau.gen2peakwatch.plist"
LABEL="com.poteau.gen2peakwatch"
W="$HOME/poteau-workspace/scripts/gen2_peak_watch.sh"
LOG="$HOME/.poteau/gen2_peak_watch.log"

if [ "${1:-}" = "--stop" ]; then
  launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST" "$STAMP"
  echo "watch stopped"; exit 0
fi
if [ "${1:-}" = "--start" ]; then
  date -u +%s > "$STAMP"; echo "watch started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi
[ -f "$STAMP" ] || { echo "no stamp; run with --start"; exit 1; }

ELAPSED=$(( ( $(date -u +%s) - $(cat "$STAMP") ) / 60 ))

# Phase 1  0-240min   : every 10 min, 10m window   (through the evening peak)
# Phase 2  240-960min : hourly, 1h window          (overnight)
# Phase 3  >960min    : one 12h summary, then stop (tomorrow morning)
if   [ "$ELAPSED" -lt 240 ]; then NEXT=10; WIN=10m; PH="peak (10-min cadence)"
elif [ "$ELAPSED" -lt 960 ]; then NEXT=60; WIN=1h;  PH="overnight (hourly)"
else
  echo "=== FINAL SUMMARY after ${ELAPSED}min ==="
  SLACK=1 "$W" 12h 2>&1
  launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST" "$STAMP"
  echo "watch complete"; exit 0
fi

echo "--- T+${ELAPSED}min · $PH ---"
SLACK=1 "$W" "$WIN" 2>&1

# LOCAL time, deliberately: launchd's StartCalendarInterval is interpreted in
# the machine's local zone, NOT UTC. Computing these with `date -u` set a fire
# time two hours in the past under CEST, so the job simply never ran -- it sat
# loaded with exit code 0, looking perfectly healthy, and every scheduled report
# silently failed to happen. No -u here.
MO=$((10#$(date -v+${NEXT}M +%m 2>/dev/null || date -d "+${NEXT} minutes" +%m)))
DY=$((10#$(date -v+${NEXT}M +%d 2>/dev/null || date -d "+${NEXT} minutes" +%d)))
HR=$((10#$(date -v+${NEXT}M +%H 2>/dev/null || date -d "+${NEXT} minutes" +%H)))
MI=$((10#$(date -v+${NEXT}M +%M 2>/dev/null || date -d "+${NEXT} minutes" +%M)))

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$HOME/.poteau/oneshots/run_gen2_peak_watch.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Month</key><integer>$MO</integer><key>Day</key><integer>$DY</integer><key>Hour</key><integer>$HR</integer><key>Minute</key><integer>$MI</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$HOME/.poteau/gen2_peak_watch.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$HOME/.nvm/versions/node/v20.19.4/bin:$HOME/google-cloud-sdk/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
</dict>
</plist>
EOF
launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST" 2>/dev/null
echo "next: $(printf '%02d:%02d' $HR $MI) LOCAL (+${NEXT}min)"
