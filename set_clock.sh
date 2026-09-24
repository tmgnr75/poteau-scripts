#!/bin/bash
# Set a simulator's clock format for a persona's MARKET, and reboot.
#
# The 12/24-hour choice is a DEVICE setting (format_date.dart: "Driven by the
# DEVICE clock setting, never by the language"), so a French screenshot on an
# AM/PM device renders "10:21pm". fr and it are European and take 24h; en and
# es serve US markets and take AM/PM.
set -uo pipefail
LANG_CODE="${1:?}"; DEVICE="${2:?}"
case "$DEVICE" in
    iphone) UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07" ;;
    ipad)   UDID="B9A41AB4-0E39-418E-8DEE-DAF746927A56" ;;
    android) exit 0 ;;   # Android follows the app locale, no device flag needed
esac
case "$LANG_CODE" in fr|it) WANT=true ;; *) WANT=false ;; esac
CUR=$(xcrun simctl spawn "$UDID" defaults read "Apple Global Domain" AppleICUForce24HourTime 2>/dev/null | tr -d '[:space:]')
[ "$CUR" = "1" ] && CUR=true || CUR=false
[ "$CUR" = "$WANT" ] && { echo "clock already $([ $WANT = true ] && echo 24h || echo AM/PM)"; exit 0; }
xcrun simctl terminate "$UDID" com.krank.club >/dev/null 2>&1
if [ "$WANT" = true ]; then
    xcrun simctl spawn "$UDID" defaults write "Apple Global Domain" AppleICUForce24HourTime -bool true >/dev/null 2>&1
else
    xcrun simctl spawn "$UDID" defaults delete "Apple Global Domain" AppleICUForce24HourTime >/dev/null 2>&1
fi
xcrun simctl shutdown "$UDID" >/dev/null 2>&1; sleep 3
xcrun simctl boot "$UDID" >/dev/null 2>&1
until xcrun simctl list devices booted 2>/dev/null | grep -q "$UDID"; do sleep 3; done
xcrun simctl location "$UDID" set 48.8566,2.3522 >/dev/null 2>&1
sleep 4
echo "clock -> $([ $WANT = true ] && echo 24h || echo AM/PM)"
