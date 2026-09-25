#!/bin/bash
#
# SET THE APP LANGUAGE IN-APP, ON THE ANDROID EMULATOR.
#
# Usage:
#   ./set_app_language_android.sh <fr|en|es|it>
#
# A separate script from set_app_language.sh for the same reason the capture
# runners are separate: Flutter draws to a canvas and Android's uiautomator
# returns an EMPTY accessibility tree, so nothing can be found by label and
# every tap is positional.
#
# Forgetting this is not a silent failure, it is a WRONG-LANGUAGE CAPTURE. On
# 2026-09-25 a Spanish and an Italian Android run were driven without it and
# came back in English, because the app's language is its own state and no
# amount of re-seeding touches it.
#
# The coordinates below are for 1080x1920, which is what shoot_persona_android.sh
# sets. They were read off a screenshot of the settings sheet.

set -uo pipefail

LANG_CODE="${1:?usage: set_app_language_android.sh <fr|en|es|it>}"
BUNDLE="com.krank.club"
SERIAL="$(adb devices | awk 'NR==2{print $1}')"
[ -n "$SERIAL" ] || { echo "no android device attached" >&2; exit 1; }

# The four flags sit in one row in the "Change language" card.
case "$LANG_CODE" in
    fr) FLAG_X=230 ;;
    en) FLAG_X=437 ;;
    es) FLAG_X=642 ;;
    it) FLAG_X=848 ;;
    *) echo "unknown language '$LANG_CODE'" >&2; exit 1 ;;
esac

log() { printf '[lang %s/android] %s\n' "$LANG_CODE" "$*"; }
tap() { adb -s "$SERIAL" shell input tap "$1" "$2" >/dev/null 2>&1; }

adb -s "$SERIAL" shell am force-stop "$BUNDLE" >/dev/null 2>&1
sleep 2
adb -s "$SERIAL" shell monkey -p "$BUNDLE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 40

# Profile tab: the fourth item in the floating bottom bar.
tap 790 1683
sleep 8
# The settings gear, top right of the profile header.
tap 990 235
sleep 8

# Scroll down to the "Change language" card. Six swipes overshoots to the
# bottom of the sheet, then three back up land the flags in view -- which is
# more reliable than trying to stop exactly on them, because the sheet's
# length changes with the account's state.
for _ in 1 2 3 4 5 6; do
    adb -s "$SERIAL" shell input swipe 540 1400 540 700 400 >/dev/null 2>&1
    sleep 2
done
for _ in 1 2 3; do
    adb -s "$SERIAL" shell input swipe 540 700 540 1400 400 >/dev/null 2>&1
    sleep 2
done

tap "$FLAG_X" 1207
sleep 12

log "tapped the $LANG_CODE flag"
adb -s "$SERIAL" shell am force-stop "$BUNDLE" >/dev/null 2>&1
