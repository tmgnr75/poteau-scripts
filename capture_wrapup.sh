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

. "$HERE/wrapup_harness_lib.sh"
wu_prepare "$CASE" || exit 1
DEV="$(wu_device)"
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
# RESOLVE THE HOME CTA BY LABEL, NEVER BY COORDINATE. The debrief card's
# position depends on how many upcoming games sit above it, so a hardcoded
# y opened an unrelated game and the run then screenshotted the wrong flow
# entirely while still reporting progress.
OPEN="$(label_xy 'Débriefer le match' 'Debrief the game' \
                 'Analizar el partido' 'Analizza la partita')"
if [ -z "$OPEN" ]; then
  echo "ABORT $CASE :: no debrief card on Home (is pending_feedback set?)" >&2
  exit 1
fi
sleep 2; $IDB ui tap $OPEN >/dev/null 2>&1; sleep 7

# The sheet's own CTA, again by label.
GO="$(label_xy 'Tout s'"'"'est bien passé' 'It all went well' \
               'Todo salió bien' 'È andato tutto bene')"
[ -n "$GO" ] && { sleep 2; $IDB ui tap $GO >/dev/null 2>&1; sleep 7; }

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
