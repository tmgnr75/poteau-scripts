#!/bin/bash
#
# CAPTURE ONE PERSONA ON ONE DEVICE.
#
# Usage:
#   ./capture_persona.sh <lang> <iphone|ipad|android>
#
# Designed to be run in PARALLEL across devices for the same persona:
#
#   ./capture_persona.sh en iphone &
#   ./capture_persona.sh en ipad    &
#   ./capture_persona.sh en android &
#   wait
#
# Personas are seeded one at a time and captured on every device at once.
# The reverse -- one device, four personas in parallel -- CANNOT work: the
# fixtures are shared state in one Firestore project, so a second persona's
# seed would rewrite the games the first is still photographing.
#
# The app binary must already be installed on the device. Building in parallel
# fails on the Xcode build lock ("concurrent builds, will retry"), so
# build_devices.sh does the builds once, up front.

set -uo pipefail

LANG_CODE="${1:?usage: capture_persona.sh <lang> <iphone|ipad|android>}"
DEVICE="${2:?usage: capture_persona.sh <lang> <iphone|ipad|android>}"

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"
OUT_ROOT="$HOME/poteau-store-screenshots/raw-520"

case "$DEVICE" in
    iphone)  UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07"; EXP_W=1320; EXP_H=2868 ;;
    ipad)    UDID="B9A41AB4-0E39-418E-8DEE-DAF746927A56"; EXP_W=2064; EXP_H=2752 ;;
    android) UDID="emulator-5554";                        EXP_W=1080; EXP_H=2400 ;;
    *) echo "unknown device '$DEVICE'" >&2; exit 1 ;;
esac

DIR="$OUT_ROOT/$DEVICE/$LANG_CODE"
mkdir -p "$DIR"

log() { printf '[%s %s/%s] %s\n' "$(date +%H:%M:%S)" "$LANG_CODE" "$DEVICE" "$*"; }

is_android() { [ "$DEVICE" = "android" ]; }

# ---------------------------------------------------------------------------
# Device primitives, one implementation per platform
# ---------------------------------------------------------------------------
ui_tree() {
    if is_android; then
        adb -s "$UDID" exec-out uiautomator dump /dev/tty 2>/dev/null
    else
        "$IDB" ui describe-all --udid "$UDID" 2>/dev/null
    fi
}

ui_tap() {
    if is_android; then
        adb -s "$UDID" shell input tap "$1" "$2" >/dev/null 2>&1
    else
        "$IDB" ui tap --udid "$UDID" "$1" "$2" 2>/dev/null
    fi
}

app_restart() {
    if is_android; then
        adb -s "$UDID" shell am force-stop "$BUNDLE" >/dev/null 2>&1
        sleep 1
        adb -s "$UDID" shell monkey -p "$BUNDLE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    else
        xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
        sleep 1
        xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1
    fi
    sleep 16
}

status_bar() {
    is_android && return 0
    xcrun simctl status_bar "$UDID" override \
        --time 9:41 --dataNetwork 5g --wifiBars 3 --cellularBars 4 \
        --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true
}

# Find an element by label substring. Echoes "x y" (tap coordinates) or nothing.
find_el() {
    ui_tree | python3 -c "
import json, sys, re
needle = sys.argv[1].lower()
raw = sys.stdin.read()
if raw.lstrip().startswith('['):
    try: d = json.loads(raw)
    except Exception: sys.exit(0)
    for e in d:
        lbl = (e.get('AXLabel') or '')
        f = e.get('frame') or {}
        if needle in lbl.lower() and f.get('width', 0) > 0:
            print(int(f['x'] + f['width']/2), int(f['y'] + f['height']/2)); break
else:
    # Android uiautomator XML: text=\"...\" bounds=\"[x1,y1][x2,y2]\"
    for m in re.finditer(r'text=\"([^\"]*)\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', raw):
        if needle in m.group(1).lower():
            x1,y1,x2,y2 = map(int, m.groups()[1:])
            print((x1+x2)//2, (y1+y2)//2); break
" "$1"
}

has_text() {
    ui_tree | python3 -c "
import sys
needle = sys.argv[1].lower()
print('YES' if needle in sys.stdin.read().lower() else 'NO')
" "$1"
}

# ---------------------------------------------------------------------------
# capture <name> -- shoot, then gate on size, weight and content
# ---------------------------------------------------------------------------
capture() {
    local name="$1"
    local out="$DIR/$name.png"
    status_bar
    sleep 3

    if is_android; then
        adb -s "$UDID" exec-out screencap -p > "$out" 2>/dev/null
    else
        xcrun simctl io "$UDID" screenshot --type=png "$out" >/dev/null 2>&1
    fi

    [ -s "$out" ] || { log "FAIL $name: no file"; return 1; }

    local w h bytes
    w=$(sips -g pixelWidth "$out" 2>/dev/null | tail -1 | awk '{print $2}')
    h=$(sips -g pixelHeight "$out" 2>/dev/null | tail -1 | awk '{print $2}')
    bytes=$(stat -f%z "$out")

    if [ "$w" != "$EXP_W" ] || [ "$h" != "$EXP_H" ]; then
        log "FAIL $name: ${w}x${h}, expected ${EXP_W}x${EXP_H}"
        rm -f "$out"; return 1
    fi
    if [ "$bytes" -lt 40000 ]; then
        log "FAIL $name: ${bytes} bytes, blank frame"
        rm -f "$out"; return 1
    fi

    # A screen that is almost entirely one colour is a skeleton or a blank
    # route, never a populated screen.
    local flat
    flat=$(python3 - "$out" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB").resize((64, 136))
c = im.getcolors(64*136) or []
print("FLAT" if c and max(c)[0] > 64*136*0.82 else "OK")
PY
)
    if [ "$flat" = "FLAT" ]; then
        log "FAIL $name: single colour dominates, skeleton or blank"
        rm -f "$out"; return 1
    fi

    log "ok   $name  ${w}x${h}  $((bytes/1024))KB"
    return 0
}

# ---------------------------------------------------------------------------
# The five screens
# ---------------------------------------------------------------------------
log "starting"
app_restart

# 1 — Home with pending invitations
capture 01_invites

# 2 — the games list
TAB=$(is_android && echo "365 2180" || echo "155 858")
ui_tap $TAB; sleep 6
capture 02_games

# 3 — a game sheet the viewer has not joined. The first card is seeded
#     joinable with one spot left; verify the join CTA before shooting, because
#     a sheet showing "follow" is a frame of a game nobody can join.
ui_tap 220 210; sleep 6
JOIN=$(has_text "join")$(has_text "rejoindre")$(has_text "unisciti")$(has_text "unirse")
if [[ "$JOIN" == *YES* ]]; then
    capture 03_sheet
else
    log "SKIP 03_sheet: no join CTA on the opened sheet"
fi
app_restart

# 4 — the Live card, mid-match
capture 04_live

# 5 — the wrap-up share card.
#
# KNOWN GAP (2026-09-24). Home offers "Alors, ce foot ?", which opens the
# four-step feedback flow; its last step is the share card. The flow's
# "Valider" button does not respond to a synthetic tap at its reported centre,
# on any offset tried, so the walk stalls on step 2 (the score confirmation).
#
# Clearing `pending_feedback` to get the direct "Voir ta carte du match" entry
# does not help either: that removes the wrap-up section from Home entirely.
#
# So screen 5 is captured MANUALLY for now, and this step records that rather
# than shipping step 2 of a feedback form as if it were the share card.
log "SKIP 05_share: wrap-up flow needs a manual walk (see script comment)"

log "done: $(ls "$DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')/5 frames"
