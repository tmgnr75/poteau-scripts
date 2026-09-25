#!/bin/bash
#
# SHOOT ALL FIVE STORE SCREENS FOR ONE PERSONA, ON ONE DEVICE.
#
# Usage:
#   ./shoot_persona.sh <lang> <iphone|ipad>
#
# This replaces capture_persona.sh, which assumed one fixture state for the
# whole run. The five screens need THREE different states, and getting them in
# the wrong order is what produced most of the bad frames on 2026-09-25:
#
#   screen 1  invitations only   park_for_invites.js
#             (viewer off every roster, list fixtures shelved a week out)
#   screen 2  the games list     park_for_invites.js --list
#             (viewer still detached, so no "Your game / FULL" card heads the
#              list, but the eight list_* fixtures are at their evening slots)
#   screens 3-5                  park_for_invites.js --restore
#             (viewer back on the rosters, Live running, wrap-up card armed)
#
# CONTROLS ARE FOUND BY LABEL, NEVER BY FIXED COORDINATES. Home's layout moves
# between states -- a Live card appears, the wrap-up card appears above it --
# so a tap written for one state opens the wrong thing in another. Twice during
# the English run a hardcoded y opened the Live game sheet instead of the
# wrap-up flow.
#
# Taps are sent as ONE-PIXEL SWIPES. These controls are StaticText in the
# accessibility tree and ignore an instantaneous synthetic touch; a swipe moves
# them. See the note in capture_persona.sh.

set -uo pipefail

LANG_CODE="${1:?usage: shoot_persona.sh <lang> <iphone|ipad>}"
DEVICE="${2:-iphone}"

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"
OUT_ROOT="$HOME/poteau-store-screenshots/raw-520"

case "$DEVICE" in
    iphone) UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07" ;;
    ipad)   UDID="B9A41AB4-0E39-418E-8DEE-DAF746927A56" ;;
    *) echo "unknown device '$DEVICE'" >&2; exit 1 ;;
esac

DIR="$OUT_ROOT/ios-$DEVICE/$LANG_CODE"
mkdir -p "$DIR"

# THE GAMES LIST SEARCHES BY RADIUS AROUND THE DEVICE'S LOCATION.
#
# A fresh install has none, so `getGamesMulti` finds nothing and screen 2 comes
# back as "non ci sono partite organizzate vicino a casa tua" -- which is what
# happened right after the 2026-09-25 rebuild. Pinning it every run costs
# nothing and removes a failure that looks like a seeding bug but is not.
#
# These are the coordinates of the sanctioned remote venue in lib/test_game.js,
# measured 939 km from the nearest of 106,385 located real users.
xcrun simctl location "$UDID" set 0.5153,25.1911 >/dev/null 2>&1 || true

# THE CLOCK FORMAT FOLLOWS THE PERSONA.
#
# formatTimeOfDay reads the DEVICE setting, deliberately, not the app language:
# a 12-hour clock is a device convention, not a French or Italian one. But a
# French listing should still show 19:00, because French devices are 24-hour --
# so the device is set to match the market rather than left wherever the last
# run put it. Setting it by hand before each run is how an Italian set came
# back reading "7pm" (2026-09-25).
#
# SpringBoard has to be restarted for the change to take, which is why this
# runs before the first launch rather than between screens.
case "$LANG_CODE" in
    fr|it) WANT24=true ;;
    *)     WANT24=false ;;
esac
HAVE24=$(xcrun simctl spawn "$UDID" defaults read "Apple Global Domain" \
          AppleICUForce24HourTime 2>/dev/null | tr -d '[:space:]')
[ "$HAVE24" = "1" ] && HAVE24=true || HAVE24=false
if [ "$WANT24" != "$HAVE24" ]; then
    xcrun simctl spawn "$UDID" defaults write "Apple Global Domain" \
        AppleICUForce24HourTime -bool "$WANT24" >/dev/null 2>&1 || true
    xcrun simctl spawn "$UDID" launchctl stop com.apple.SpringBoard >/dev/null 2>&1 || true
    sleep 8
fi

log() { printf '[%s %s/%s] %s\n' "$(date +%H:%M:%S)" "$LANG_CODE" "$DEVICE" "$*"; }

# --- device primitives ------------------------------------------------------
tree() { "$IDB" ui describe-all --udid "$UDID" 2>/dev/null; }

# Echo "x y" for the first visible element whose label contains any needle.
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

tap_xy() {
    "$IDB" ui swipe --udid "$UDID" "$1" "$2" $(($1 + 1)) "$2" --duration 0.2 2>/dev/null
}

# Tap the first control matching any of the given labels. Returns 1 on a miss,
# so a caller can report which step of a flow actually failed.
tap_label() {
    local c x y
    c=$(find_xy "$@") || true
    [ -z "$c" ] && { log "MISS: $1"; return 1; }
    x=${c%% *}; y=${c##* }
    tap_xy "$x" "$y"
    return 0
}

restart() {
    xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
    sleep 3
    xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1
    sleep 26
}

# EVERY FRAME CARRIES 9:41, WITHOUT EXCEPTION (Cowork, 2026-09-25).
#
# This used to pass the Live fixture's real clock on screens 4 and 5, so the
# status bar would agree with the card's own "Today at 4pm". That produced a
# set where screen 1 read 9:41 and the others read 16:14, 16:51, 4:21, 16:33 --
# inconsistent across a composed listing, where the status bar is chrome rather
# than content and nobody reads it against the card.
#
# One clock for the whole set wins. The card's kickoff and the status bar
# disagreeing is invisible; frames disagreeing with each other is not.
STATUS_CLOCK="9:41"

status_bar() {
    xcrun simctl status_bar "$UDID" override \
        --time "$STATUS_CLOCK" --dataNetwork 5g --wifiBars 3 --cellularBars 4 \
        --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true
}

shoot() {
    local name="$1" clock="${2:-9:41}"
    status_bar "$clock"
    sleep 3
    local out="$DIR/$name.png"
    xcrun simctl io "$UDID" screenshot --type=png "$out" >/dev/null 2>&1
    if [ ! -s "$out" ]; then log "FAIL $name: no file"; return 1; fi
    local bytes; bytes=$(stat -f%z "$out")
    if [ "$bytes" -lt 40000 ]; then
        log "FAIL $name: ${bytes} bytes, blank frame"; rm -f "$out"; return 1
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
# The soccer tab is the SECOND item in the bottom bar. It has no label, so it
# is found by position within the bar rather than by text -- and the bar itself
# is located rather than assumed, because the iPad centres its content in a
# 500pt column: a fraction-of-width guess that works on a 440pt phone lands on
# the home tab on a 1032pt tablet.
TAB=$(tree | python3 -c "
import json, sys
d = json.load(sys.stdin)
app = [e for e in d if e.get('type') == 'Application']
H = app[0]['frame']['height'] if app else 956
bar = [e for e in d if e.get('type') == 'Image'
       and (e.get('frame') or {}).get('width', 0) > 0
       and e['frame']['y'] > H*0.85]
bar.sort(key=lambda e: e['frame']['x'])
if len(bar) >= 2:
    f = bar[1]['frame']
    print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2))
else:
    W = app[0]['frame']['width'] if app else 440
    print(int(W*0.35), int(H*0.90))
")
tap_xy $TAB
sleep 7

# THE SLATE ROLLS TO TOMORROW WHEN THE EVENING HAS PASSED.
#
# eveningSlate() moves the whole slate forward rather than pushing kickoffs into
# the small hours, so a capture run after ~17:15 seeds games dated TOMORROW.
# The games list opens on "Today", which is then correctly empty and shoots the
# "no games organised near you" state (2026-09-25, 18:41).
#
# So: if Today has no game card, move to the next day tab. The day tabs are the
# labelled controls in the green header, and the second one is tomorrow.
if [ -n "$(find_xy 'no soccer games' 'aucun match' 'non ci sono partite' 'no hay partidos')" ]; then
    log "today is empty, the slate rolled to tomorrow"
    # The tab is found BY ITS WORD, not by position in the header. Picking the
    # "second labelled control near the top" instead opened the location and
    # radius sheet, because the screen title is itself such a control.
    NEXT=$(find_xy 'tomorrow' 'demain' 'domani' 'mañana')
    if [ -n "$NEXT" ]; then
        tap_xy $NEXT
        sleep 7
    else
        log "WARN: could not find the next-day tab"
    fi
fi
shoot 02_games

# --- 3: a game sheet --------------------------------------------------------
# The first card in the list is seeded joinable with one spot left.
FIRST=$(tree | python3 -c "
import json, sys
d = json.load(sys.stdin)
cand = [e for e in d if (e.get('frame') or {}).get('width', 0) > 200
        and 300 < e['frame']['y'] < 1000 and (e.get('AXLabel') or '').strip()]
cand.sort(key=lambda e: e['frame']['y'])
if cand:
    f = cand[0]['frame']; print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2))
")
if [ -n "$FIRST" ]; then
    tap_xy $FIRST
    sleep 8
    shoot 03_sheet
else
    log "SKIP 03_sheet: no card found in the list"
fi

# --- 4 and 5: Live, then the wrap-up ----------------------------------------
log "state: live + wrap-up"
node "$HERE/park_for_invites.js" --restore >/dev/null 2>&1
# THE GOALS STEP APPENDS A REAL EVENT EVERY TIME THE WALK PASSES IT.
#
# So a second capture of screen 5 renders "2 GOALS SCORED" where the brief asks
# for one, and a third would read 3. The fixture's live_events are rewritten
# from scratch before each run, which makes the capture repeatable.
node "$HERE/reset_wrap_goals.js" >/dev/null 2>&1
restart

# HOME ONLY LISTS A GAME THAT KICKED OFF WITHIN THE LAST 30 MINUTES.
#
# --restore stamps the kickoff, but the relaunch and the four screens before
# this one take several minutes, so by the time the Live frame is shot the
# fixture can already have aged out -- which is how the French 04_live came
# back showing the wrap-up card and a full game instead of the scoreboard.
# Confirm the Live card is actually on screen, and if it is not, re-stamp the
# kickoff and relaunch once.
if [ -z "$(find_xy 'my team' 'mon équipe' 'mi equipo' 'mia squadra')" ]; then
    log "Live card aged out, re-stamping kickoff"
    node "$HERE/park_for_invites.js" --restore >/dev/null 2>&1
    node "$HERE/reset_wrap_goals.js" >/dev/null 2>&1
    restart
fi
# SCREEN 4 LEADS WITH THE LIVE SCOREBOARD, so the wrap-up card is suppressed
# for this frame and re-armed for screen 5. Home renders the wrap-up ABOVE the
# Live card, which pushed the scoreboard to the middle of the frame and made a
# finished game the first thing a viewer read on a screen selling Poteau Live.
node -e "
const a = require('firebase-admin');
a.initializeApp({credential: a.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')), projectId: 'krank-club'});
const db = a.firestore();
db.collection('users').where('store_anchor','==',true).limit(1).get().then(async s => {
  await s.docs[0].ref.update({ pending_feedback: [] });
  process.exit(0);
});
" >/dev/null 2>&1
restart
shoot 04_live

# Re-arm the wrap-up card for screen 5.
node "$HERE/park_for_invites.js" --restore >/dev/null 2>&1
node "$HERE/reset_wrap_goals.js" >/dev/null 2>&1
restart

# The wrap-up flow: four steps, each found by label so a moved card cannot send
# the walk into the Live game sheet instead.
#
# The goals step is NOT touched. It already shows the seeded count, and tapping
# its stepper appends a real live_events attribution -- which is how the card
# came to read "2 GOALS SCORED" when the brief asks for one.
if tap_label "how was it" "alors, ce" "com'è andata" "qué tal"; then
    sleep 7
    # "Todo FUE bien", not "todo bien" -- a needle that is not a substring of
    # the real string silently misses and the whole walk stalls on step 1.
    tap_label "all went fine" "tout s'est bien" "tutto bene" "todo fue bien" && sleep 7
    tap_label "confirm" "valider" "conferma" "confirmar" && sleep 8
    tap_label "continue" "continuer" "continua" "continuar" && sleep 10
    if [ -n "$(find_xy 'played on poteau' 'joué sur poteau' 'giocato su poteau' 'jugado en poteau')" ]; then
        shoot 05_share
    else
        log "FAIL 05_share: the flow did not reach the share card"
    fi
else
    log "SKIP 05_share: no wrap-up card on Home"
fi

log "done: $(ls "$DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')/5 frames"
