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
DEV="$(xcrun simctl list devices booted | sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' | head -1)"
xcrun simctl terminate "$DEV" com.krank.club >/dev/null 2>&1
sleep 2
xcrun simctl launch "$DEV" com.krank.club >/dev/null 2>&1
sleep 14

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
$IDB ui describe-all >/dev/null 2>&1; sleep 2
$IDB ui tap 201 348 >/dev/null 2>&1; sleep 6
$IDB ui tap 201 269 >/dev/null 2>&1; sleep 7

# Walk the steps. A describe-all immediately before a tap can swallow it, so
# always settle in between.
for _ in $(seq 1 8); do
  L="$(labels)"
  case "$L" in *"JOUÉ SUR POTEAU"*) break;; esac
  # Some steps have NO primary CTA at all -- the result step is answered by
  # tapping an option, and its only button is the ghost. Fall through to the
  # ghost list rather than giving up when no CTA is present.
  XY="$(label_xy Valider Continuer Terminer)"
  if [ -n "$XY" ]; then
    sleep 2
    $IDB ui tap $XY >/dev/null 2>&1
    sleep 8
  fi

  # A padel game with no sets entered keeps Valider DISABLED on purpose -- a
  # blank padel score is 0-0, which is not a padel score. The way past is the
  # skip, so fall back to it whenever the screen did not change.
  if [ "$(labels)" = "$L" ]; then
    SKIP="$(label_xy 'Je ne connais pas le score' 'I do not know the score' \
                     'No sé el marcador' 'Non so il punteggio' \
                     'Finalement, tout allait bien' 'Actually, it was fine' \
                     Passer Skip)"
    if [ -n "$SKIP" ]; then
      sleep 2
      $IDB ui tap $SKIP >/dev/null 2>&1
      sleep 8
    else
      break   # nothing left to press: stop rather than spin
    fi
  fi
done

L="$(labels)"
case "$L" in
  *"JOUÉ SUR POTEAU"*) echo "OK   $CASE" ;;
  *)                   echo "MISS $CASE :: ${L:0:120}" ;;
esac
$IDB screenshot "$OUT" >/dev/null 2>&1
