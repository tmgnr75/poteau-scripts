#!/bin/bash
#
# SHOOT THE LANDSCAPE LIVE SCOREBOARD FOR ONE PERSONA.
#
# Usage:
#   ./shoot_live_board.sh <lang>
#
# Output: raw-520/ios-iphone-landscape/<lang>/04_live_board.png, native
# 2868x1320.
#
# The board is the full-screen scoreboard behind "Noter le score" on the Live
# card. It is the only LANDSCAPE frame in the set, and the only one that shows
# the score at the size the score deserves.
#
# WHAT THE FRAME MUST SHOW (Cowork, 2026-09-25): mid-match, our side leading
# 3-2, the match clock running, and the undo control visible.
#
# THE ROTATION IS THE WHOLE TRICK. The board is a landscape-locked route: the
# app rotates itself once the route is open, so the simulator must be told to
# follow. `simctl ui <udid> orientation` does not exist, so the device is
# rotated by its hardware-key equivalent through idb, and the screenshot is
# taken once the frame comes back 2868x1320 rather than 1320x2868.

set -uo pipefail

LANG_CODE="${1:?usage: shoot_live_board.sh <lang>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"
UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07"

DIR="$HOME/poteau-store-screenshots/raw-520/ios-iphone-landscape/$LANG_CODE"
mkdir -p "$DIR"

log() { printf '[%s %s/board] %s\n' "$(date +%H:%M:%S)" "$LANG_CODE" "$*"; }
tree() { "$IDB" ui describe-all --udid "$UDID" 2>/dev/null; }

find_xy() {
    tree | python3 -c "
import json, sys
ns = [n.lower() for n in sys.argv[1:]]
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    l = (e.get('AXLabel') or ''); f = e.get('frame') or {}
    if f.get('width', 0) > 0 and any(n in l.lower() for n in ns):
        print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2)); break
" "$@"
}
tap_xy() { "$IDB" ui swipe --udid "$UDID" "$1" "$2" $(($1 + 1)) "$2" --duration 0.2 2>/dev/null; }
tap_label() {
    local c x y
    c=$(find_xy "$@") || true
    [ -z "$c" ] && { log "MISS: $1"; return 1; }
    x=${c%% *}; y=${c##* }
    tap_xy "$x" "$y"
}

xcrun simctl location "$UDID" set 0.5153,25.1911 >/dev/null 2>&1 || true

# The Live fixture must be running and the wrap-up card out of the way, exactly
# as for the portrait screen 4.
log "arming the live fixture"
node "$HERE/park_for_invites.js" --restore >/dev/null 2>&1
node "$HERE/reset_wrap_goals.js" >/dev/null 2>&1
node -e "
const a = require('firebase-admin');
a.initializeApp({credential: a.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')), projectId: 'krank-club'});
a.firestore().collection('users').where('store_anchor','==',true).limit(1).get()
  .then(async s => { await s.docs[0].ref.update({ pending_feedback: [] }); process.exit(0); });
" >/dev/null 2>&1

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1; sleep 3
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1; sleep 26

# "Noter le score" / "Keep score" / "Segna il punteggio" / "Anotar el marcador"
if ! tap_label "keep score" "noter le score" "segna il punteggio" "anotar"; then
    log "FAIL: no Live card on Home"
    exit 1
fi
sleep 9

# The route rotates itself. Wait for the capture to come back landscape rather
# than assuming a fixed delay: on a cold launch the rotation can take several
# seconds, and a portrait screenshot of a landscape route is a torn frame.
OUT="$DIR/04_live_board.png"
for i in 1 2 3 4 5 6 7 8; do
    xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork 5g \
        --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100 \
        >/dev/null 2>&1 || true
    xcrun simctl io "$UDID" screenshot --type=png "$OUT" >/dev/null 2>&1
    W=$(sips -g pixelWidth "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')
    H=$(sips -g pixelHeight "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')
    [ -n "$W" ] && [ "$W" -gt "$H" ] && { log "landscape after ${i} attempt(s): ${W}x${H}"; break; }
    sleep 4
done

[ -s "$OUT" ] || { log "FAIL: no file"; exit 1; }
W=$(sips -g pixelWidth "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')
H=$(sips -g pixelHeight "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')
if [ "$W" -lt "$H" ]; then
    log "FAIL: still portrait (${W}x${H}) -- the board route did not open"
    exit 1
fi
log "ok   04_live_board  ${W}x${H}  $(( $(stat -f%z "$OUT") / 1024 ))KB"
