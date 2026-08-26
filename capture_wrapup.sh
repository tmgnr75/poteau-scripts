#!/usr/bin/env bash
# Drive the wrap-up flow on the simulator for one seeded case and screenshot
# the share card at the end.
#
# Reseeds before every case ON PURPOSE. live_events are a SUBCOLLECTION and
# survive the parent game's deletion, so goal attributions accumulate across
# runs and a later capture shows a total that no earlier one produced.
set -uo pipefail
export IDB_COMPANION=${IDB_COMPANION:-localhost:10882}
IDB=~/.idb/venv/bin/idb
CASE="$1"
OUT="${2:?usage: capture_wrapup.sh <case> <out.png>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

node "$HERE/seed_wrapup_cases.js" --write >/dev/null 2>&1
node "$HERE/_only.js" "$CASE"          >/dev/null 2>&1

# Cold restart: a reload leaves Firestore's Dart layer orphaned and reads
# never complete (see handovers/SESSION_2026-08-25.md).
kill -USR2 "$(cat /tmp/flutter.pid)" 2>/dev/null
sleep 17

label_xy() {  # echo "x y" for the first button whose label matches
  $IDB ui describe-all 2>/dev/null | python3 -c "
import json,sys
want=set(sys.argv[1:])
for e in json.load(sys.stdin):
    if (e.get('AXLabel') or '').strip() in want:
        f=e['frame']; print(f\"{f['x']+f['width']/2:.0f} {f['y']+f['height']/2:.0f}\"); break
" "$@"
}

labels() {
  $IDB ui describe-all 2>/dev/null | python3 -c "
import json,sys
print(' | '.join((e.get('AXLabel') or '').replace(chr(10),' ')
                 for e in json.load(sys.stdin) if (e.get('AXLabel') or '').strip()))
"
}

# Open the pending-feedback card on Home, then its CTA.
$IDB ui tap 201 348 >/dev/null 2>&1; sleep 6
$IDB ui tap 201 269 >/dev/null 2>&1; sleep 6

# Walk the steps. A describe-all immediately before a tap can swallow it, so
# always settle in between.
for _ in $(seq 1 8); do
  L="$(labels)"
  case "$L" in *"JOUÉ SUR POTEAU"*) break;; esac
  XY="$(label_xy Valider Continuer Terminer)"
  [ -z "$XY" ] && break
  sleep 2
  $IDB ui tap $XY >/dev/null 2>&1
  sleep 8
done

L="$(labels)"
case "$L" in
  *"JOUÉ SUR POTEAU"*) echo "OK   $CASE" ;;
  *)                   echo "MISS $CASE :: ${L:0:120}" ;;
esac
$IDB screenshot "$OUT" >/dev/null 2>&1
