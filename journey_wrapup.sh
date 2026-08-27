#!/usr/bin/env bash
# Walk one seeded case through the wrap-up flow, screenshotting EVERY step.
#
# Unlike capture_wrapup.sh (which only wants the final card), this records the
# whole journey so a reviewer sees what the player sees, in order.
set -uo pipefail
export IDB_COMPANION=${IDB_COMPANION:-localhost:10882}
IDB=~/.idb/venv/bin/idb
CASE="$1"
OUTDIR="${2:?usage: journey_wrapup.sh <case> <outdir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUTDIR"
LOG="$OUTDIR/journey.log"
: > "$LOG"

. "$HERE/wrapup_harness_lib.sh"
wu_prepare "$CASE" || exit 1
DEV="$(wu_device)"
labels() {
  $IDB ui describe-all 2>/dev/null | python3 -c "
import json,sys
print(' | '.join((e.get('AXLabel') or '').replace(chr(10),' ')
                 for e in json.load(sys.stdin) if (e.get('AXLabel') or '').strip()))
"
}
label_xy() {
  $IDB ui describe-all 2>/dev/null | python3 -c "
import json,sys
want=set(sys.argv[1:])
for e in json.load(sys.stdin):
    if (e.get('AXLabel') or '').strip() in want:
        f=e['frame']; print(f\"{f['x']+f['width']/2:.0f} {f['y']+f['height']/2:.0f}\"); break
" "$@"
}
N=0
shot() {  # shot <slug>
  N=$((N+1))
  local f; f="$(printf '%s/%02d-%s.png' "$OUTDIR" "$N" "$1")"
  $IDB screenshot "$f" >/dev/null 2>&1
  printf '%02d  %-22s %s\n' "$N" "$1" "$(labels | cut -c1-150)" >> "$LOG"
}

shot home

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
shot home-card-open

# The sheet's own CTA, again by label.
GO="$(label_xy 'Tout s'"'"'est bien passé' 'It all went well' \
               'Todo salió bien' 'È andato tutto bene')"
[ -n "$GO" ] && { sleep 2; $IDB ui tap $GO >/dev/null 2>&1; sleep 7; }

for _ in $(seq 1 9); do
  L="$(labels)"
  case "$L" in *"JOUÉ SUR POTEAU"*|*"PLAYED ON"*) shot card; break;; esac

  # Name the step from its heading so the filenames read as a journey.
  SLUG="$(python3 - "$L" <<'PY'
import sys, re, unicodedata
l = sys.argv[1]
head = l.split('|')[1].strip() if '|' in l else 'step'
s = unicodedata.normalize('NFKD', head).encode('ascii','ignore').decode()
print(re.sub(r'[^a-z0-9]+','-', s.lower()).strip('-')[:26] or 'step')
PY
)"
  shot "$SLUG"

  XY="$(label_xy Valider Continuer Terminer)"
  if [ -n "$XY" ]; then
    # The first tap after a describe-all gets swallowed, and shot() has just
    # made two. Settle, then tap the coordinates already resolved.
    sleep 3
    $IDB ui tap $XY >/dev/null 2>&1; sleep 8
    if [ "$(labels)" = "$L" ]; then sleep 2; $IDB ui tap $XY >/dev/null 2>&1; sleep 8; fi
  fi

  if [ "$(labels)" = "$L" ]; then
    SKIP="$(label_xy 'Je ne connais pas le score' 'I do not know the score' \
                     'Finalement, tout allait bien' 'Actually, it was fine' \
                     Passer Skip)"
    if [ -n "$SKIP" ]; then sleep 2; $IDB ui tap $SKIP >/dev/null 2>&1; sleep 8
    else break; fi
  fi
done

L="$(labels)"
case "$L" in
  *"JOUÉ SUR POTEAU"*|*"PLAYED ON"*) echo "OK   $CASE ($N shots)" ;;
  *) echo "MISS $CASE :: ${L:0:110}" ;;
esac
