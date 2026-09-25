#!/bin/bash
#
# SET THE APP LANGUAGE IN-APP, ON ONE DEVICE.
#
# Usage:
#   ./set_app_language.sh <fr|en|es|it> <iphone|ipad>
#
# The app language is NOT a launch argument. Passing -AppleLanguages switches
# the system strings but not the app's own locale state, so times still render
# through the wrong branch and a French frame shows "8pm". The only thing that
# moves FFLocalizations is the flag picker in Settings.
#
# EVERY COORDINATE IS RESOLVED, NEVER ASSUMED. The iPad centres its content in
# a 500pt column inside a 1032pt screen, so "the control near the right edge"
# finds nothing there: the settings gear sits at x=734 on a screen whose right
# edge is 1032. A phone-derived fraction opened the photo picker instead
# (2026-09-25).
#
# The flag row is re-read immediately before the tap. It shifts by a few points
# as the settings sheet settles, and a stale y taps the row above -- which is
# how an English run stayed in French once.

set -uo pipefail

LANG_CODE="${1:?usage: set_app_language.sh <fr|en|es|it> <iphone|ipad>}"
DEVICE="${2:-iphone}"

IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"

case "$DEVICE" in
    iphone) UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07" ;;
    ipad)   UDID="B9A41AB4-0E39-418E-8DEE-DAF746927A56" ;;
    *) echo "unknown device '$DEVICE'" >&2; exit 1 ;;
esac

case "$LANG_CODE" in
    fr) FLAG='🇫🇷' ;;
    en) FLAG='🇺🇸' ;;
    es) FLAG='🇪🇸' ;;
    it) FLAG='🇮🇹' ;;
    *) echo "unknown language '$LANG_CODE'" >&2; exit 1 ;;
esac

log() { printf '[lang %s/%s] %s\n' "$LANG_CODE" "$DEVICE" "$*"; }
tree() { "$IDB" ui describe-all --udid "$UDID" 2>/dev/null; }
tap() { "$IDB" ui swipe --udid "$UDID" "$1" "$2" $(($1 + 1)) "$2" --duration 0.25 2>/dev/null; }

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1; sleep 3
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1; sleep 26

# The profile tab is the LAST image in the bottom bar, on both form factors.
C=$(tree | python3 -c "
import json, sys
d = json.load(sys.stdin)
app = [e for e in d if e.get('type') == 'Application']
H = app[0]['frame']['height'] if app else 956
bar = [e for e in d if e.get('type') == 'Image'
       and (e.get('frame') or {}).get('width', 0) > 0 and e['frame']['y'] > H*0.85]
bar.sort(key=lambda e: e['frame']['x'])
if bar:
    f = bar[-1]['frame']; print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2))
")
[ -z "$C" ] && { log "profile tab not found"; exit 1; }
tap ${C%% *} ${C##* }; sleep 7

# The settings gear is the SMALL control furthest right in the header, found
# relative to the CONTENT COLUMN rather than the screen.
S=$(tree | python3 -c "
import json, sys
d = json.load(sys.stdin)
cand = [e for e in d if 0 < (e.get('frame') or {}).get('width', 0) < 60
        and e['frame']['y'] < 130 and e['frame']['height'] < 60]
if cand:
    cand.sort(key=lambda e: e['frame']['x'])
    f = cand[-1]['frame']; print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2))
")
[ -z "$S" ] && { log "settings gear not found"; exit 1; }
tap ${S%% *} ${S##* }; sleep 7

# Scroll until the flag row is on screen.
for _ in 1 2 3 4 5 6; do
    R=$(tree | python3 -c "
import json, sys
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    if (e.get('AXLabel') or '') == sys.argv[1]:
        f = e.get('frame') or {}
        if f.get('width', 0) > 0:
            print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2)); break
" "$FLAG")
    [ -n "$R" ] && break
    G=$(tree | python3 -c "
import json, sys
d = json.load(sys.stdin)
app = [e for e in d if e.get('type') == 'Application']
W = app[0]['frame']['width'] if app else 440
H = app[0]['frame']['height'] if app else 956
print(int(W/2), int(H*0.82), int(W/2), int(H*0.42))
")
    "$IDB" ui swipe --udid "$UDID" $G --duration 0.4 2>/dev/null
    sleep 2
done

# Re-read after the sheet settles, then tap in the same breath.
sleep 3
R=$(tree | python3 -c "
import json, sys
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    if (e.get('AXLabel') or '') == sys.argv[1]:
        f = e.get('frame') or {}
        if f.get('width', 0) > 0:
            print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2)); break
" "$FLAG")
[ -z "$R" ] && { log "flag $FLAG not found"; exit 1; }
tap ${R%% *} ${R##* }
sleep 12

log "set to $FLAG"
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
