#!/bin/bash
#
# STORE SCREENSHOT CAPTURE — 5.2.0 (STORE_SCREENSHOTS_5.2.0.md §4)
#
# Captures one screen at native resolution and verifies its pixel size. Called
# once per screen, per language, per device.
#
# Usage:
#   ./capture_store_screenshots.sh <device-udid> <iphone|ipad> <lang> <name>
#
# Example:
#   ./capture_store_screenshots.sh 7506B541-... iphone fr 01_invites
#
# WHY A SCRIPT RATHER THAN A BARE simctl CALL
# -------------------------------------------
# Three things have to be true for every single file, and forgetting any one of
# them is only discoverable after the whole session is over:
#
#   1. The status bar must be overridden (9:41, full bars, charged). It resets
#      whenever the device reboots, so it is re-applied before EVERY capture
#      rather than once per session.
#   2. The file must be at the device's native resolution. A window grab or a
#      scaled capture is unusable for a store listing, so the size is asserted
#      against the expected value and the capture FAILS loudly if it is wrong.
#   3. It must be a real PNG with non-trivial content. A black frame is what a
#      capture taken while the app is backgrounded looks like, and it is easy
#      to miss in a directory of 40 files.
#
# A screenshot can also be a STALE FRAME: simctl returns whatever the window
# server last composited, which may predate a hot reload that has not painted
# yet. The caller must therefore settle the UI before calling this, and the
# --settle flag adds a delay for that purpose.

set -euo pipefail

UDID="${1:?device udid required}"
DEVICE="${2:?device class required: iphone|ipad}"
LANG_CODE="${3:?language required: fr|en|es|it}"
NAME="${4:?screen name required, e.g. 01_invites}"
SETTLE="${5:-1.5}"

OUT_ROOT="$HOME/poteau-store-screenshots/raw-520"

case "$DEVICE" in
    iphone) DIR="$OUT_ROOT/ios-iphone/$LANG_CODE"; EXP_W=1320; EXP_H=2868 ;;
    ipad)   DIR="$OUT_ROOT/ios-ipad/$LANG_CODE";   EXP_W=2064; EXP_H=2752 ;;
    *) echo "unknown device class '$DEVICE' (expected iphone|ipad)" >&2; exit 1 ;;
esac

mkdir -p "$DIR"
OUT="$DIR/$NAME.png"

# (1) Status bar, re-applied every time. Cheap, and it survives nothing.
xcrun simctl status_bar "$UDID" override \
    --time 9:41 \
    --dataNetwork 5g \
    --wifiBars 3 \
    --cellularBars 4 \
    --batteryState charged \
    --batteryLevel 100 >/dev/null 2>&1 || true

# Let the UI settle so the capture is not a stale frame.
sleep "$SETTLE"

xcrun simctl io "$UDID" screenshot --type=png "$OUT" >/dev/null 2>&1

if [ ! -f "$OUT" ]; then
    echo "FAIL  $NAME: no file written" >&2
    exit 1
fi

# (2) Native resolution, asserted rather than assumed.
W=$(sips -g pixelWidth  "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')
H=$(sips -g pixelHeight "$OUT" 2>/dev/null | tail -1 | awk '{print $2}')

if [ "$W" != "$EXP_W" ] || [ "$H" != "$EXP_H" ]; then
    echo "FAIL  $NAME: ${W}x${H}, expected ${EXP_W}x${EXP_H}" >&2
    exit 1
fi

# (3) Not a black or near-empty frame. A uniform image compresses to almost
# nothing, so file size is a sufficient and very cheap proxy.
BYTES=$(stat -f%z "$OUT")
if [ "$BYTES" -lt 40000 ]; then
    echo "WARN  $NAME: only ${BYTES} bytes -- likely a black or blank frame" >&2
fi

printf "ok    %-18s %sx%s  %6s KB  %s\n" \
    "$NAME" "$W" "$H" "$((BYTES / 1024))" "$LANG_CODE"
