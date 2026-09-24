#!/bin/bash
#
# LOG A PERSONA'S VIEWER IN ON ONE DEVICE, AND SET THE APP LANGUAGE.
#
# Usage:
#   ./login_persona.sh <lang> <iphone|ipad|android>
#
# Every persona has its own viewer account, so switching persona means signing
# out and back in -- the app caches the user document and the Auth display name
# for the session, and neither refreshes on a relaunch alone.
#
# TWO THINGS THAT COST AN EVENING TO LEARN:
#
#   1. The app language is set IN-APP, not by launch arguments. Passing
#      -AppleLanguages switches the UI strings but NOT the app's own locale
#      state, so times still render through the English branch and a French
#      screenshot shows "8pm" instead of "20:00".
#   2. The device region must stay en_US. Setting it to fr_FR gives the
#      simulator an AZERTY keyboard, and `idb ui text` sends keycodes, so an
#      email types as "ti,:qrnould_t,gnr2icloud:co,". The pasteboard is no
#      escape either: the simulator syncs it from the host and overwrites
#      whatever was set.

set -uo pipefail

LANG_CODE="${1:?usage: login_persona.sh <lang> <iphone|ipad|android>}"
DEVICE="${2:?usage: login_persona.sh <lang> <iphone|ipad|android>}"

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"
PASSWORD="PoteauStore!2026"

case "$DEVICE" in
    iphone)  UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07" ;;
    ipad)    UDID="B9A41AB4-0E39-418E-8DEE-DAF746927A56" ;;
    android) UDID="$(adb devices | awk 'NR==2{print $1}')" ;;
    *) echo "unknown device '$DEVICE'" >&2; exit 1 ;;
esac

is_android() { [ "$DEVICE" = "android" ]; }
log() { printf '[%s login %s/%s] %s\n' "$(date +%H:%M:%S)" "$LANG_CODE" "$DEVICE" "$*"; }

EMAIL=$(node -e "
const a=require('firebase-admin');
a.initializeApp({credential:a.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const {PERSONAS}=require('$HERE/lib/store_personas');
a.firestore().collection('users').where('store_persona','==','$LANG_CODE').get().then(s=>{
  const want=PERSONAS['$LANG_CODE'].viewer.display;
  s.forEach(d=>{if(d.data().display_name===want)console.log(d.data().email);});
  process.exit(0);});
" 2>/dev/null | head -1)

[ -n "$EMAIL" ] || { log "no viewer account found"; exit 1; }
log "viewer: $EMAIL"

ui_tap() {
    if is_android; then adb -s "$UDID" shell input tap "$1" "$2" >/dev/null 2>&1
    else "$IDB" ui tap --udid "$UDID" "$1" "$2" 2>/dev/null; fi
}
ui_text() {
    if is_android; then adb -s "$UDID" shell input text "$(printf '%s' "$1" | sed 's/@/\\@/g')" >/dev/null 2>&1
    else "$IDB" ui text --udid "$UDID" "$1" 2>/dev/null; fi
}
ui_tree() {
    if is_android; then adb -s "$UDID" exec-out uiautomator dump /dev/tty 2>/dev/null
    else "$IDB" ui describe-all --udid "$UDID" 2>/dev/null; fi
}
restart() {
    if is_android; then
        adb -s "$UDID" shell am force-stop "$BUNDLE" >/dev/null 2>&1; sleep 1
        adb -s "$UDID" shell monkey -p "$BUNDLE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    else
        xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1; sleep 1
        xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1
    fi
    sleep 16
}
has() { ui_tree | grep -qi "$1" && echo YES || echo NO; }

# The profile tab is the LAST item in the bottom tab bar, and the settings
# gear the top-right control. Both are found by geometry rather than a fixed
# point, so the same code drives a phone and a tablet.
open_profile() {
    local c
    c=$(ui_tree | python3 -c "
import json,sys
d=json.load(sys.stdin)
app=[e for e in d if e.get('type')=='Application']
H=app[0]['frame']['height'] if app else 956
imgs=[e for e in d if e.get('type')=='Image' and (e.get('frame') or {}).get('width',0)>0
      and e['frame']['y'] > H*0.82]
if imgs:
    imgs.sort(key=lambda e: e['frame']['x'])
    f=imgs[-1]['frame']; print(int(f['x']+f['width']/2), int(f['y']+f['height']/2))
")
    [ -n "$c" ] && ui_tap $c
}
# Scroll a sheet by 40% of the screen height, so the same call works on a
# phone and a tablet.
scroll_down() {
    local g
    g=$(ui_tree | python3 -c "
import json,sys
d=json.load(sys.stdin)
app=[e for e in d if e.get('type')=='Application']
W=app[0]['frame']['width'] if app else 440
H=app[0]['frame']['height'] if app else 956
print(int(W/2), int(H*0.82), int(W/2), int(H*0.42))
")
    [ -n "$g" ] && "$IDB" ui swipe --udid "$UDID" $g --duration 0.4 2>/dev/null
}

open_settings() {
    local c
    c=$(ui_tree | python3 -c "
import json,sys
d=json.load(sys.stdin)
app=[e for e in d if e.get('type')=='Application']
W=app[0]['frame']['width'] if app else 440
cand=[e for e in d if 0 < (e.get('frame') or {}).get('width',0) < 80
      and e['frame']['y'] < 140 and e['frame']['x'] > W*0.80]
if cand:
    f=cand[0]['frame']; print(int(f['x']+f['width']/2), int(f['y']+f['height']/2))
")
    [ -n "$c" ] && ui_tap $c
}

# --- sign out if a session is live -----------------------------------------
restart
if [ "$(has 'Tes matchs')" = YES ] || [ "$(has 'Your games')" = YES ] || \
   [ "$(has 'Le tue partite')" = YES ] || [ "$(has 'Tus partidos')" = YES ]; then
    log "signing out the previous viewer"
    open_profile; sleep 4
    open_settings; sleep 4
    for _ in 1 2 3 4 5 6; do
        scroll_down; sleep 1
    done
    C=$(ui_tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    lbl=(e.get('AXLabel') or '').lower(); f=e.get('frame') or {}
    if any(k in lbl for k in ['déconnect','log out','esci','cerrar sesión','disconnect']) and f.get('width',0)>0:
        print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
")
    [ -n "$C" ] && { ui_tap $C; sleep 8; }
fi

# --- log in -----------------------------------------------------------------
#
# COORDINATES ARE RESOLVED, NEVER HARDCODED. The iPad is 1032x1376 points and
# the iPhone 440x956, so a tap written for one misses everything on the other.
find_label() {
    ui_tree | python3 -c "
import json,sys
needles=[n.lower() for n in sys.argv[1:]]
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    lbl=(e.get('AXLabel') or '').lower(); f=e.get('frame') or {}
    if f.get('width',0)>0 and any(n in lbl for n in needles):
        print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
" "$@"
}
# Nth text field on screen, 0-indexed, by vertical order.
find_field() {
    ui_tree | python3 -c "
import json,sys
idx=int(sys.argv[1])
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
fs=[e for e in d if e.get('type')=='TextField' and (e.get('frame') or {}).get('width',0)>0]
fs.sort(key=lambda e: e['frame']['y'])
if len(fs)>idx:
    f=fs[idx]['frame']; print(int(f['x']+f['width']/2), int(f['y']+f['height']/2))
" "$1"
}

log "logging in"
C=$(find_label "continue with email" "continuer par email" "continua con email" "continuar con email")
[ -n "$C" ] && { ui_tap $C; sleep 4; }
C=$(find_label "already have" "déjà un compte" "ho già" "ya tengo")
[ -n "$C" ] && { ui_tap $C; sleep 4; }

C=$(find_field 0); [ -n "$C" ] && { ui_tap $C; sleep 1; }
ui_text "$EMAIL"; sleep 2
C=$(find_field 1); [ -n "$C" ] && { ui_tap $C; sleep 1; }
ui_text "$PASSWORD"; sleep 2

# The keyboard closes on submit and the button moves, so find it rather than
# assuming a fixed y.
C=$(ui_tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    lbl=(e.get('AXLabel') or '').lower(); f=e.get('frame') or {}
    if any(k in lbl for k in ['valider','confirm','conferma','validar']) and f.get('width',0)>0:
        print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
")
[ -n "$C" ] && { ui_tap $C; sleep 5; }
# The keyboard closes on submit and the button moves; find it again.
C=$(find_label "valider" "confirm" "conferma" "validar")
[ -n "$C" ] && ui_tap $C
sleep 18

if [ "$(has 'Tes matchs')" = YES ] || [ "$(has 'Your games')" = YES ] || \
   [ "$(has 'Le tue partite')" = YES ] || [ "$(has 'Tus partidos')" = YES ]; then
    log "logged in"
else
    log "WARNING: login may not have completed"
fi

# --- set the app language ---------------------------------------------------
case "$LANG_CODE" in
    fr) FLAG_X=107 ;;
    en) FLAG_X=182 ;;
    es) FLAG_X=257 ;;
    it) FLAG_X=332 ;;
esac
log "setting app language"
open_profile; sleep 5
open_settings; sleep 5
ROW=""
for _ in 1 2 3 4 5; do
    ROW=$(ui_tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    if (e.get('AXLabel') or '')=='🇫🇷':
        f=e.get('frame') or {}
        if f.get('width',0)>0: print(int(f['y']+f['height']/2)); break
")
    [ -n "$ROW" ] && break
    scroll_down; sleep 2
done
# Re-read after the scroll settles: the row moves, and a stale y taps nothing.
sleep 4
ROW=$(ui_tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    if (e.get('AXLabel') or '')=='🇫🇷':
        f=e.get('frame') or {}
        if f.get('width',0)>0: print(int(f['y']+f['height']/2)); break
")
if [ -n "$ROW" ]; then
    ui_tap "$FLAG_X" "$ROW"; sleep 9
    log "language set"
else
    log "WARNING: language picker not found"
fi

restart
log "ready"
