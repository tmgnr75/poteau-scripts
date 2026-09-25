#!/bin/bash
#
# SHOOT THE STORE SCREENS FOR ONE PERSONA ON ANDROID.
#
# Usage:
#   ./shoot_persona_android.sh <lang>
#
# WHY THIS IS A SEPARATE SCRIPT FROM shoot_persona.sh
#
# The iOS runner finds every control by LABEL, reading idb's accessibility
# tree. That does not work here: Flutter draws to a canvas and Android's
# uiautomator returns an EMPTY tree unless semantics are explicitly enabled,
# so `uiautomator dump` yields zero text nodes on every Poteau screen
# (verified 2026-09-25 -- it sees the system permission dialog and nothing
# inside the app).
#
# So Android taps are POSITIONAL, expressed as fractions of the screen, and
# every one of them is verified against a screenshot rather than an element.
# That makes this runner more fragile than the iOS one by construction, which
# is why it shoots the four screens that need no in-app navigation and stops
# short of the five-step wrap-up walk.
#
# THE DEVICE
#
#   1080x1920, set with `adb shell wm size`. The stock Pixel 3a AVD is
#   1080x2220, which FAILS Play's rule that the long side may not exceed twice
#   the short side (2220 > 2160). 1080x1920 is the recommended size and
#   complies at a ratio of 1.78.

set -uo pipefail

LANG_CODE="${1:?usage: shoot_persona_android.sh <lang>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="com.krank.club"
OUT_ROOT="$HOME/poteau-store-screenshots/raw-520"
DIR="$OUT_ROOT/android/$LANG_CODE"
mkdir -p "$DIR"

SERIAL="$(adb devices | awk 'NR==2{print $1}')"
[ -n "$SERIAL" ] || { echo "no android device attached" >&2; exit 1; }

log() { printf '[%s %s/android] %s\n' "$(date +%H:%M:%S)" "$LANG_CODE" "$*"; }

W=1080
H=1920

restart() {
    adb -s "$SERIAL" shell am force-stop "$BUNDLE" >/dev/null 2>&1
    sleep 2
    adb -s "$SERIAL" shell monkey -p "$BUNDLE" \
        -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    sleep 22
}

tap() { adb -s "$SERIAL" shell input tap "$1" "$2" >/dev/null 2>&1; }

shoot() {
    local name="$1" out="$DIR/$1.png"
    sleep 3
    adb -s "$SERIAL" exec-out screencap -p > "$out" 2>/dev/null
    [ -s "$out" ] || { log "FAIL $name: no file"; return 1; }
    local bytes; bytes=$(stat -f%z "$out")
    if [ "$bytes" -lt 40000 ]; then
        log "FAIL $name: ${bytes} bytes, blank frame"; rm -f "$out"; return 1
    fi
    # A DEBUG BUILD DRAWS OVERFLOW STRIPES. They are yellow-and-black hazard
    # bars with "OVERFLOWED BY n PIXELS" written across them, and they must
    # never reach a store listing -- so a frame carrying one is reported rather
    # than silently kept.
    local ov
    ov=$(python3 - "$out" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
w, h = im.size
hits = 0
for y in range(0, h, 3):
    for x in range(0, w, 7):
        r, g, b = im.getpixel((x, y))
        # The hazard yellow is roughly (255, 235, 59) with black stripes.
        if r > 225 and g > 200 and b < 110:
            hits += 1
print("OVERFLOW" if hits > 400 else "OK")
PY
)
    if [ "$ov" = "OVERFLOW" ]; then
        log "WARN $name: debug overflow stripe present (debug build)"
    fi
    log "ok   $name  $((bytes/1024))KB"
}

# --- 1: invitations only ----------------------------------------------------
log "state: invitations only"
node "$HERE/park_for_invites.js" >/dev/null 2>&1
restart
shoot 01_invites

# --- 2: the games list ------------------------------------------------------
log "state: games list"
node "$HERE/park_for_invites.js" --list >/dev/null 2>&1
restart
# The bottom bar is a floating pill. Its four tabs sit at roughly 27%, 42%,
# 57% and 73% of the width, centred on 88% of the height.
tap $((W*42/100)) $((H*88/100))
sleep 7
shoot 02_games

# --- 3: a game sheet --------------------------------------------------------
# The first card's title sits around 27% of the height on the games list.
tap $((W*50/100)) $((H*27/100))
sleep 8
shoot 03_sheet

# --- 4: Poteau Live ---------------------------------------------------------
log "state: live"
node "$HERE/park_for_invites.js" --restore >/dev/null 2>&1
node "$HERE/reset_wrap_goals.js" >/dev/null 2>&1
# Screen 4 leads with the scoreboard, so the wrap-up card is suppressed for
# this frame exactly as on iOS.
node -e "
const a = require('firebase-admin');
a.initializeApp({credential: a.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')), projectId: 'krank-club'});
a.firestore().collection('users').where('store_anchor','==',true).limit(1).get()
  .then(async s => { await s.docs[0].ref.update({ pending_feedback: [] }); process.exit(0); });
" >/dev/null 2>&1
restart
shoot 04_live

# SCREEN 5 IS NOT SHOT HERE.
#
# The wrap-up share card needs a five-step walk whose every control would have
# to be tapped blind, since there is no accessibility tree to find them in. On
# iOS that walk is driven by label and is reliable; here it would be four
# guesses in a row, and a wrong one silently captures the middle of a feedback
# form instead of the share card. The iOS 05_share frames cover that screen.
log "SKIP 05_share: needs label-driven navigation, unavailable on Android"

log "done: $(ls "$DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')/4 frames"
